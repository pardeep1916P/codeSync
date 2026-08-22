import { Submission } from '../parser/types';
import { GitHubClient } from '../github/client';
import { ReadmeGenerator } from '../readme';
import { storage } from '../storage';
import { updateReadmeTable, computeGitSha } from './readmeTable';
import { getFileExtension } from '../utils/languages';

export class CommitQueue {
  private isProcessing = false;
  private enqueuePromise: Promise<void> = Promise.resolve();

  /**
   * Adds a submission to the queue.
   * If syncOnAccept is enabled, processes immediately.
   * Otherwise, the submission stays pending until manual sync or the periodic alarm.
   */
  async enqueue(submission: Submission): Promise<void> {
    this.enqueuePromise = this.enqueuePromise.then(() => this.enqueueInternal(submission));
    return this.enqueuePromise;
  }

  private async enqueueInternal(submission: Submission): Promise<void> {
    console.log('[CodeSync:Queue] Starting enqueue for:', submission.id, submission.problem.title);
    const settings = await storage.getSettings();
    console.log('[CodeSync:Queue] Current settings at enqueue:', {
      syncOnAccept: settings.syncOnAccept,
      queueLength: settings.commitQueue.length,
      currentQueue: settings.commitQueue,
    });
    
    // Check for duplicates of the exact same submission ID
    if (settings.commitQueue.includes(submission.id)) {
      console.log('[CodeSync:Queue] Submission ID already in queue, skipping:', submission.id);
      return;
    }

    // Deduplicate: Find and remove any existing pending submission for the same problem slug
    const cleanedQueue: string[] = [];
    const keysToRemove: string[] = [];
    
    for (const id of settings.commitQueue) {
      const data = await this.getSubmissionData(id);
      const isSameProblem = data && data.problem && data.problem.slug === submission.problem.slug;
      const isSameLanguage = data && data.language && submission.language && data.language.toLowerCase().trim() === submission.language.toLowerCase().trim();
      
      if (isSameProblem && isSameLanguage) {
        console.log('[CodeSync:Queue] Deduplicating previous pending submission for same problem:', id);
        keysToRemove.push(`sub_${id}`);
      } else {
        cleanedQueue.push(id);
      }
    }

    // Remove the old submission data from storage
    if (keysToRemove.length > 0) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(keysToRemove);
      } else {
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }
    }

    // Store submission details temporarily
    console.log('[CodeSync:Queue] Saving sub payload to storage:', `sub_${submission.id}`);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [`sub_${submission.id}`]: submission });
    } else {
      localStorage.setItem(`sub_${submission.id}`, JSON.stringify(submission));
    }

    // Add to queue
    const updatedQueue = [...cleanedQueue, submission.id];
    console.log('[CodeSync:Queue] Updating settings.commitQueue to:', updatedQueue);
    await storage.updateSettings({ commitQueue: updatedQueue });

    // Only process immediately if instant sync is enabled
    if (settings.syncOnAccept) {
      console.log('[CodeSync:Queue] syncOnAccept is true, triggering processQueue()');
      await this.processQueue();
    } else {
      console.log('[CodeSync:Queue] syncOnAccept is false, notifying queue updated with length:', updatedQueue.length);
      // Notify the popup that the queue updated so the count refreshes
      this.notifyQueueUpdated(updatedQueue.length, submission.problem.title);
    }
  }

  /**
   * Processes all pending submissions in the queue with ultra-fast batching.
   * Single problem or 10+ queued problems sync in a single atomic Git Tree commit.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[CodeSync:Queue] processQueue already in progress, skipping duplicate call');
      return;
    }
    this.isProcessing = true;
    console.log('[CodeSync:Queue] processQueue started');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ codesync_is_syncing: true });
    }

    try {
      const settings = await storage.getSettings();
      if (!settings.githubToken || !settings.selectedRepo) {
        console.warn('[CodeSync:Queue] Cannot process queue: missing token or repo');
        return;
      }

      const client = new GitHubClient(settings.githubToken);
      const repoFullName = settings.selectedRepo;
      const pendingIds = [...settings.commitQueue];
      console.log('[CodeSync:Queue] Pending IDs to commit:', pendingIds);
      if (pendingIds.length === 0) {
        console.log('[CodeSync:Queue] No pending IDs in queue to commit');
        return;
      }

      // 1. Fetch entire repository sync context in ONE batched request (via GraphQL or parallel REST)
      console.log('[CodeSync:Queue] Fetching sync context for repo:', repoFullName);
      const context = await client.fetchSyncContext(repoFullName);

      let workingReadme = context.rootReadmeContent;
      let workingStats: { shas: Record<string, Record<string, string>>; solved: number } = {
        shas: {},
        solved: 0,
      };

      if (context.statsContent) {
        try {
          workingStats = JSON.parse(context.statsContent);
          if (!workingStats.shas) workingStats.shas = {};
        } catch {
          workingStats = { shas: {}, solved: 0 };
        }
      }

      // Load and sort all pending submissions chronologically (oldest to newest)
      const validSubmissions: Submission[] = [];
      for (const submissionId of pendingIds) {
        const submission = await this.getSubmissionData(submissionId);
        if (!submission) {
          await this.removeIdFromQueue(submissionId);
          continue;
        }
        validSubmissions.push(submission);
      }

      if (validSubmissions.length === 0) {
        console.log('[CodeSync:Queue] No valid submissions to commit');
        return;
      }

      validSubmissions.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      let currentLatestCommitSha = context.latestCommitSha;
      let currentBaseTreeSha = context.baseTreeSha;
      const processedIds: string[] = [];
      const problemTitles: string[] = [];

      for (const submission of validSubmissions) {
        const problem = submission.problem;
        const fileExtension = this.getFileExtension(submission.language);
        const layout = settings.folderLayout || 'flat';
        const platform = submission.platform || problem.platform || 'leetcode';
        let problemFolder = `${problem.slug}`;
        if (layout === 'platform') {
          problemFolder = `${platform}/${problem.slug}`;
        } else if (layout === 'difficulty') {
          problemFolder = `${platform}/${problem.difficulty || 'Medium'}/${problem.slug}`;
        }

        const codePath = `${problemFolder}/${problem.slug}.${fileExtension}`;
        const readmePath = `${problemFolder}/README.md`;

        // Generate problem README and update table in memory
        const readmeContent = ReadmeGenerator.generate(problem, submission, null);
        workingReadme = updateReadmeTable(workingReadme, problem, submission, repoFullName);

        // Compute Git SHAs
        const [codeSha, problemReadmeSha] = await Promise.all([
          computeGitSha(submission.code),
          computeGitSha(readmeContent),
        ]);

        workingStats.shas[problem.slug] = {
          ...(workingStats.shas[problem.slug] || {}),
          [`${problem.slug}.${fileExtension}`]: codeSha,
          "README.md": problemReadmeSha,
        };
        delete workingStats.shas[problem.slug]["difficulty"];

        const singleFilesToCommit: { path: string; content: string }[] = [
          { path: codePath, content: submission.code },
          { path: readmePath, content: readmeContent }
        ];

        // Finalize Root README and stats.json
        const finalReadme = workingReadme || '# LeetCode Solutions\n';
        const rootReadmeSha = await computeGitSha(finalReadme);
        workingStats.shas["README.md"] = { "": rootReadmeSha };
        workingStats.solved = Object.keys(workingStats.shas).filter(k => k !== 'README.md' && k !== 'stats.json').length;

        workingStats.shas["stats.json"] = { "": "" };
        let statsStr = JSON.stringify(workingStats, null, 2);
        const statsSha = await computeGitSha(statsStr);
        workingStats.shas["stats.json"] = { "": statsSha };
        statsStr = JSON.stringify(workingStats, null, 2);

        singleFilesToCommit.push(
          { path: 'README.md', content: finalReadme },
          { path: 'stats.json', content: statsStr }
        );

        const commitMessage = `feat(leetcode): add solution for ${problem.title}`;
        const authorDate = submission.timestamp ? new Date(submission.timestamp).toISOString() : undefined;

        console.log(`[CodeSync:Queue] Creating commit for ${problem.title} with timestamp: ${authorDate}`);

        const result = await client.createCommit(repoFullName, {
          message: commitMessage,
          files: singleFilesToCommit,
          branch: context.branch,
          baseCommitSha: currentLatestCommitSha || undefined,
          baseTreeSha: currentBaseTreeSha || undefined,
          authorDate,
        });

        currentLatestCommitSha = result.commitSha;
        currentBaseTreeSha = result.treeSha;

        processedIds.push(submission.id);
        problemTitles.push(problem.title);

        // Update local stats count after each problem
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ codesync_solved_count: workingStats.solved });
        }

        // Clean up individual submission data from storage
        await this.clearSubmissionData(submission.id);
      }

      // Update remaining queue
      const remainingQueue = (await storage.getSettings()).commitQueue.filter(id => !processedIds.includes(id));
      await storage.updateSettings({ commitQueue: remainingQueue });

      this.notifySyncResult(
        problemTitles.length === 1 ? problemTitles[0] : `${problemTitles.length} problems`,
        true
      );
    } catch (error) {
      this.notifySyncResult('Queue', false, (error as Error).message);
    } finally {
      this.isProcessing = false;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ codesync_is_syncing: false });
      }
    }
  }

  private async getSubmissionData(id: string): Promise<Submission | null> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const key = `sub_${id}`;
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } else {
      const item = localStorage.getItem(`sub_${id}`);
      return item ? JSON.parse(item) : null;
    }
  }

  private async clearSubmissionData(id: string): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove(`sub_${id}`);
    } else {
      localStorage.removeItem(`sub_${id}`);
    }
  }

  private async removeIdFromQueue(id: string): Promise<void> {
    const settings = await storage.getSettings();
    const updatedQueue = settings.commitQueue.filter(qId => qId !== id);
    await storage.updateSettings({ commitQueue: updatedQueue });
  }

  getFileExtension(language: string): string {
    return getFileExtension(language);
  }

  private notifySyncResult(problemTitle: string, success: boolean, errorMessage?: string) {
    if (typeof chrome !== 'undefined') {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: success ? 'SYNC_SUCCESS' : 'SYNC_FAILED',
          payload: { problemTitle, error: errorMessage }
        }).catch(() => {
          // Ignore errors when popup is closed and no listener exists
        });
      }

      storage.getSettings().then((settings) => {
        if (settings.desktopNotifications && chrome.notifications && chrome.notifications.create) {
          const iconUrl = typeof chrome.runtime?.getURL === 'function' 
            ? chrome.runtime.getURL('icon-128.png') 
            : 'icon-128.png';
          chrome.notifications.create(`sync_${Date.now()}`, {
            type: 'basic',
            iconUrl,
            title: success ? 'CodeSync - Sync Success' : 'CodeSync - Sync Failed',
            message: success 
              ? `Successfully synced "${problemTitle}" to GitHub!`
              : `Failed to sync "${problemTitle}": ${errorMessage || 'Unknown error'}`,
            priority: 2
          }, () => {
            // Silent notification callback
          });
        }
      }).catch(() => {});
    }
  }

  private notifyQueueUpdated(queueLength: number, problemTitle: string) {
    if (typeof chrome !== 'undefined') {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'SUBMISSION_QUEUED',
          payload: { problemTitle, queueLength }
        }).catch(() => {
          // Ignore errors when popup is closed
        });
      }

      storage.getSettings().then((settings) => {
        if (settings.desktopNotifications && chrome.notifications && chrome.notifications.create) {
          const iconUrl = typeof chrome.runtime?.getURL === 'function' 
            ? chrome.runtime.getURL('icon-128.png') 
            : 'icon-128.png';
          chrome.notifications.create(`queued_${Date.now()}`, {
            type: 'basic',
            iconUrl,
            title: 'CodeSync - Submission Queued',
            message: `"${problemTitle}" added to queue (${queueLength} pending). Sync manually or wait for auto-sync.`,
            priority: 1
          }, () => {
            // Silent notification callback
          });
        }
      }).catch(() => {});
    }
  }


}

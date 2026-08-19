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
    const settings = await storage.getSettings();
    
    // Check for duplicates of the exact same submission ID
    if (settings.commitQueue.includes(submission.id)) {
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

    // Add to queue
    const updatedQueue = [...cleanedQueue, submission.id];
    await storage.updateSettings({ commitQueue: updatedQueue });

    // Store submission details temporarily
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [`sub_${submission.id}`]: submission });
    } else {
      localStorage.setItem(`sub_${submission.id}`, JSON.stringify(submission));
    }

    // Only process immediately if instant sync is enabled
    if (settings.syncOnAccept) {
      await this.processQueue();
    } else {
      // Notify the popup that the queue updated so the count refreshes
      this.notifyQueueUpdated(updatedQueue.length, submission.problem.title);
    }
  }

  /**
   * Processes all pending submissions in the queue with ultra-fast batching.
   * Single problem or 10+ queued problems sync in a single atomic Git Tree commit.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ codesync_is_syncing: true });
    }

    try {
      const settings = await storage.getSettings();
      if (!settings.githubToken || !settings.selectedRepo) {
        return;
      }

      const client = new GitHubClient(settings.githubToken);
      const repoFullName = settings.selectedRepo;
      const pendingIds = [...settings.commitQueue];
      if (pendingIds.length === 0) return;

      // 1. Fetch entire repository sync context in ONE batched request (via GraphQL or parallel REST)
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

      const filesToCommit: { path: string; content: string }[] = [];
      const processedIds: string[] = [];
      const problemTitles: string[] = [];

      for (const submissionId of pendingIds) {
        const submission = await this.getSubmissionData(submissionId);
        if (!submission) {
          await this.removeIdFromQueue(submissionId);
          continue;
        }

        const problem = submission.problem;
        const fileExtension = this.getFileExtension(submission.language);
        const problemFolder = `${problem.slug}`;
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

        filesToCommit.push(
          { path: codePath, content: submission.code },
          { path: readmePath, content: readmeContent }
        );

        processedIds.push(submissionId);
        problemTitles.push(problem.title);
      }

      if (filesToCommit.length === 0) return;

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

      filesToCommit.push(
        { path: 'README.md', content: finalReadme },
        { path: 'stats.json', content: statsStr }
      );

      // Create commit message
      const commitMessage = problemTitles.length === 1
        ? `feat(leetcode): add solution for ${problemTitles[0]}`
        : `feat(leetcode): sync ${problemTitles.length} solutions (${problemTitles.slice(0, 3).join(', ')}${problemTitles.length > 3 ? '...' : ''})`;

      // 2. Perform Single Atomic Multi-File Commit (< 1 second)
      await client.createCommit(repoFullName, {
        message: commitMessage,
        files: filesToCommit,
        branch: context.branch,
        baseCommitSha: context.latestCommitSha || undefined,
        baseTreeSha: context.baseTreeSha || undefined,
      });

      // 3. Update local cache
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ codesync_solved_count: workingStats.solved });
      }

      // 4. Clean up all processed submissions in one batch
      for (const id of processedIds) {
        await this.clearSubmissionData(id);
      }
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

      if (chrome.notifications && chrome.notifications.create) {
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

      if (chrome.notifications && chrome.notifications.create) {
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
    }
  }


}

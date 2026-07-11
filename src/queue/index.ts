import { Submission } from '../parser/types';
import { GitHubClient } from '../github/client';
import { ReadmeGenerator } from '../readme';
import { storage } from '../storage';
import { updateReadmeTable, computeGitSha } from './readmeTable';
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
      console.log(`Submission ${submission.id} is already in the queue.`);
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
        console.log(`Deduplicating: removing older pending submission ${id} for problem ${submission.problem.slug} [${submission.language}]`);
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
      console.log(`Instant sync is OFF. Submission "${submission.problem.title}" queued (${updatedQueue.length} pending).`);
      // Notify the popup that the queue updated so the count refreshes
      this.notifyQueueUpdated(updatedQueue.length, submission.problem.title);
    }
  }

  /**
   * Processes all pending submissions in the queue.
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
        console.warn('GitHub is not configured. Queue processing paused.');
        this.isProcessing = false;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ codesync_is_syncing: false });
        }
        return;
      }

      const client = new GitHubClient(settings.githubToken);
      const pendingIds = [...settings.commitQueue];
      console.log(`Starting queue processing. Found ${pendingIds.length} pending submissions.`);

      for (const submissionId of pendingIds) {
        console.log(`Processing submission ID: ${submissionId}`);
        const submission = await this.getSubmissionData(submissionId);
        if (!submission) {
          console.warn(`Submission data for ID ${submissionId} is missing or corrupt. Removing from queue.`);
          // Clean up orphan ID
          await this.removeIdFromQueue(submissionId);
          continue;
        }

        try {
          await this.uploadSubmission(client, settings.selectedRepo, submission);
          
          // Remove from queue on success
          await this.removeIdFromQueue(submissionId);
          await this.clearSubmissionData(submissionId);
          console.log(`Successfully synced submission ${submissionId}`);
          this.notifySyncResult(submission.problem.title, true);
        } catch (error) {
          console.error(`Failed to upload submission ${submissionId}:`, error);
          this.notifySyncResult(submission.problem.title, false, (error as Error).message);
          // Stop queue processing and keep it in the queue for retries
          break;
        }
      }
    } finally {
      this.isProcessing = false;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ codesync_is_syncing: false });
      }
    }
  }

  private async uploadSubmission(
    client: GitHubClient,
    repoFullName: string,
    submission: Submission
  ): Promise<void> {
    const problem = submission.problem;
    const fileExtension = this.getFileExtension(submission.language);
    const problemFolder = `${problem.slug}`;
    const codePath = `${problemFolder}/${problem.slug}.${fileExtension}`;
    const readmePath = `${problemFolder}/README.md`;

    // Fetch existing individual README.md if it exists
    let existingProblemReadme: string | null = null;
    try {
      const readmeFile = await client.getFileContent(repoFullName, readmePath);
      if (readmeFile) {
        existingProblemReadme = readmeFile.content;
      }
    } catch (e) {
      // Ignore if it doesn't exist yet
    }

    // Generate content
    const readmeContent = ReadmeGenerator.generate(problem, submission, existingProblemReadme);

    // Fetch existing root README.md
    let existingReadme: string | null = null;
    try {
      const readmeFile = await client.getFileContent(repoFullName, 'README.md');
      if (readmeFile) {
        existingReadme = readmeFile.content;
      }
    } catch (e) {
      // Ignore error and initialize new README
    }

    const updatedReadme = updateReadmeTable(existingReadme, problem, submission);

    // Fetch existing stats.json
    let existingStatsContent: string | null = null;
    try {
      const statsFile = await client.getFileContent(repoFullName, 'stats.json');
      if (statsFile) {
        existingStatsContent = statsFile.content;
      }
    } catch (e) {
      // Ignore error
    }

    let stats: { shas: Record<string, any>; solved: number } = {
      shas: {},
      solved: 0
    };

    if (existingStatsContent) {
      try {
        stats = JSON.parse(existingStatsContent);
        if (!stats.shas) stats.shas = {};
      } catch (e) {
        console.warn('Failed to parse existing stats.json, resetting stats.', e);
      }
    }

    // Compute SHAs of files to commit
    const codeSha = await computeGitSha(submission.code);
    const problemReadmeSha = await computeGitSha(readmeContent);
    const rootReadmeSha = await computeGitSha(updatedReadme);

    // Update shas mapping by merging to keep other language files for this problem
    stats.shas[problem.slug] = {
      ...(stats.shas[problem.slug] || {}),
      [`${problem.slug}.${fileExtension}`]: codeSha,
      "README.md": problemReadmeSha
    };

    // Remove "difficulty" field from this problem's shas if it exists
    if (stats.shas[problem.slug]) {
      delete stats.shas[problem.slug]["difficulty"];
    }

    stats.shas["README.md"] = {
      "": rootReadmeSha
    };

    // Calculate solved count (excluding README.md and stats.json keys)
    stats.solved = Object.keys(stats.shas).filter(k => k !== 'README.md' && k !== 'stats.json').length;

    // Self-hashing for stats.json
    stats.shas["stats.json"] = { "": "" };
    let statsStr = JSON.stringify(stats, null, 2);
    const statsSha = await computeGitSha(statsStr);
    stats.shas["stats.json"] = { "": statsSha };
    statsStr = JSON.stringify(stats, null, 2);

    // Cache solved count locally so popup can read it without making a GitHub request
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ codesync_solved_count: stats.solved });
    }

    // Atomic upload containing all files in a single Git commit
    await client.createCommit(repoFullName, {
      message: `feat(leetcode): add solution for ${problem.title} [${submission.language}]`,
      files: [
        { path: codePath, content: submission.code },
        { path: readmePath, content: readmeContent },
        { path: 'README.md', content: updatedReadme },
        { path: 'stats.json', content: statsStr },
      ],
      authorDate: new Date(submission.timestamp).toISOString(),
    });
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

  private getFileExtension(language: string): string {
    const lang = language.toLowerCase().trim();
    if (lang.includes('c++') || lang === 'cpp') return 'cpp';
    if (lang.includes('javascript') || lang === 'js') return 'js';
    if (lang.includes('typescript') || lang === 'ts') return 'ts';
    if (lang.includes('python') || lang === 'py') return 'py';
    if (lang.includes('java')) return 'java';
    if (lang.includes('go') || lang === 'golang') return 'go';
    if (lang.includes('rust') || lang === 'rs') return 'rs';
    if (lang.includes('csharp') || lang === 'cs' || lang === 'c#') return 'cs';
    return 'txt';
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
        const DEFAULT_ICON = 'icon.png';
        chrome.notifications.create(`sync_${Date.now()}`, {
          type: 'basic',
          iconUrl: DEFAULT_ICON,
          title: success ? 'CodeSync - Sync Success' : 'CodeSync - Sync Failed',
          message: success 
            ? `Successfully synced "${problemTitle}" to GitHub!`
            : `Failed to sync "${problemTitle}": ${errorMessage || 'Unknown error'}`,
          priority: 2
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[CodeSync] Notification error (sync):', chrome.runtime.lastError.message);
          }
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
        const DEFAULT_ICON = 'icon.png';
        chrome.notifications.create(`queued_${Date.now()}`, {
          type: 'basic',
          iconUrl: DEFAULT_ICON,
          title: 'CodeSync - Submission Queued',
          message: `"${problemTitle}" added to queue (${queueLength} pending). Sync manually or wait for auto-sync.`,
          priority: 1
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[CodeSync] Notification error (queue):', chrome.runtime.lastError.message);
          }
        });
      }
    }
  }


}

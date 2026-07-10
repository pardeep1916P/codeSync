import { Submission } from '../parser/types';
import { GitHubClient } from '../github/client';
import { ReadmeGenerator } from '../readme';
import { storage } from '../storage';

export class CommitQueue {
  private isProcessing = false;

  /**
   * Adds a submission to the queue and processes it.
   */
  async enqueue(submission: Submission): Promise<void> {
    const settings = await storage.getSettings();
    
    // Check for duplicates
    if (settings.commitQueue.includes(submission.id)) {
      console.log(`Submission ${submission.id} is already in the queue.`);
      return;
    }

    // Add to queue
    const updatedQueue = [...settings.commitQueue, submission.id];
    await storage.updateSettings({ commitQueue: updatedQueue });

    // Store submission details temporarily
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [`sub_${submission.id}`]: submission });
    } else {
      localStorage.setItem(`sub_${submission.id}`, JSON.stringify(submission));
    }

    // Process queue
    await this.processQueue();
  }

  /**
   * Processes all pending submissions in the queue.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const settings = await storage.getSettings();
      if (!settings.githubToken || !settings.selectedRepo) {
        console.warn('GitHub is not configured. Queue processing paused.');
        this.isProcessing = false;
        return;
      }

      const client = new GitHubClient(settings.githubToken);
      const pendingIds = [...settings.commitQueue];

      for (const submissionId of pendingIds) {
        const submission = await this.getSubmissionData(submissionId);
        if (!submission) {
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
        } catch (error) {
          console.error(`Failed to upload submission ${submissionId}:`, error);
          // Stop queue processing and keep it in the queue for retries
          break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async uploadSubmission(
    client: GitHubClient,
    repoFullName: string,
    submission: Submission
  ): Promise<void> {
    const problem = submission.problem;
    const fileExtension = this.getFileExtension(submission.language);
    
    // Construct paths
    const problemFolder = `${problem.slug}`;
    const codePath = `${problemFolder}/${problem.slug}.${fileExtension}`;
    const readmePath = `${problemFolder}/README.md`;

    // Generate content
    const readmeContent = ReadmeGenerator.generate(problem, submission);

    // Atomic upload containing both files in a single Git commit
    await client.createCommit(repoFullName, {
      message: `feat(leetcode): add solution for ${problem.title} [${submission.language}]`,
      files: [
        { path: codePath, content: submission.code },
        { path: readmePath, content: readmeContent },
      ],
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
}

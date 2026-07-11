---
name: repository-sync
description: LeetCode submission synchronization to GitHub, queue processing, README table generation, and folder structure management for CodeSync.
---

# Repository Sync — Queue Processing & File Management

## Purpose & Scope

Use this skill when implementing or modifying the sync pipeline that pushes LeetCode solutions to GitHub, generates problem READMEs, updates root statistics, or manages folder structures.

---

## Sync Pipeline Architecture

```
Queue Processing Pipeline:
1. Read pending queue from chrome.storage
2. For each submission ID:
   a. Fetch cached submission data (sub_{id})
   b. Generate file path based on folder structure
   c. Generate problem README
   d. Update root README stats table
   e. Push all files as single atomic commit (Trees API)
   f. Remove submission from queue
   g. Clear cached submission data
   h. Notify popup/user
```

---

## Implementation Patterns

### Pattern 1: Queue Processor

```typescript
async processQueue(settings: Settings): Promise<void> {
  const queue = settings.commitQueue || [];
  if (queue.length === 0) return;
  
  const client = new GitHubTreesClient(
    settings.githubToken,
    settings.selectedRepo.split('/')[0],
    settings.selectedRepo.split('/')[1]
  );
  
  for (const submissionId of queue) {
    try {
      const data = await storage.getSubmission(submissionId);
      if (!data) {
        await this.removeFromQueue(submissionId);
        continue;
      }
      
      const files = this.generateFiles(data, settings);
      const commitMessage = this.generateCommitMessage(data, settings.commitPrefix);
      
      await client.pushFiles(files, commitMessage);
      
      await this.removeFromQueue(submissionId);
      await storage.removeSubmission(submissionId);
      
      this.notifySyncResult(data.problem.title, true);
    } catch (error) {
      this.notifySyncResult(data?.problem?.title || 'Unknown', false, error.message);
      
      if (error instanceof GitHubAPIError && !error.isRetryable) {
        await this.removeFromQueue(submissionId);
      }
      break; // Stop on first failure
    }
  }
}
```

### Pattern 2: Root README Stats Table

```typescript
function generateRootReadme(problems: ProblemEntry[]): string {
  const easy = problems.filter(p => p.difficulty === 'Easy').length;
  const medium = problems.filter(p => p.difficulty === 'Medium').length;
  const hard = problems.filter(p => p.difficulty === 'Hard').length;
  
  const header = [
    '# LeetCode Solutions',
    '',
    `> Synced by [CodeSync](https://github.com/pardeep1916P/codeSync)`,
    '',
    '## Stats',
    '',
    `| Total | Easy | Medium | Hard |`,
    `|-------|------|--------|------|`,
    `| ${problems.length} | ${easy} | ${medium} | ${hard} |`,
    '',
    '## Solutions',
    '',
    '| # | Problem | Difficulty | Language | Solution |',
    '|---|---------|-----------|----------|----------|',
  ];
  
  const rows = problems
    .sort((a, b) => parseInt(a.id) - parseInt(b.id))
    .map(p => 
      `| ${p.id} | [${p.title}](${p.folder}/) | ${p.difficulty} | ${p.language} | [Solution](${p.folder}/solution.${p.ext}) |`
    );
  
  return [...header, ...rows, ''].join('\n');
}
```

---

## Checklists

- [ ] Queue processed sequentially (not in parallel)
- [ ] Failed items left in queue for retry (if retryable)
- [ ] Submission cache cleared after successful push
- [ ] Root README updated with latest stats
- [ ] Commit message includes problem title
- [ ] Folder structure matches user preference
- [ ] Atomic commit includes all related files

---

## References

- [GitHub Trees API](https://docs.github.com/en/rest/git/trees)

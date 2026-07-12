---
name: github-trees-api
description: GitHub Git Trees API for atomic multi-file commits, blob creation, tree construction, and commit pushing in CodeSync.
---

# GitHub Trees API — Atomic Multi-File Commits

## Purpose & Scope

Use this skill when:
- Pushing code files to GitHub repositories from the extension
- Creating atomic commits with multiple files (source + README)
- Understanding the Git Trees API low-level workflow
- Handling API errors, rate limits, and conflict resolution
- Implementing file path mapping strategies

Do NOT use when:
- Setting up OAuth authentication (see `github/oauth-flow`)
- Handling rate limiting logic (see `github/rate-limiting`)
- Managing repository selection (see `github/repo-management`)

---

## Decision Tree

```
Need to push files to GitHub?
├─ Single file? → Still use Trees API for atomic commit
├─ Multiple files? → Trees API (preferred — single commit)
├─ Which API?
│  ├─ Contents API (PUT /repos/contents) → Simple but ONE file per commit
│  ├─ Trees API (POST /repos/git/trees) → Multiple files, atomic ✓
│  └─ GraphQL createCommitOnBranch → Modern alternative
├─ File already exists?
│  ├─ Update → Include in tree with new content
│  └─ Create → Include in tree as new blob
└─ Large file (>100MB)?
   └─ Use Git LFS (not supported in Trees API)
```

---

## Architecture & Concepts

### Trees API Workflow

```
Step 1: Create blobs for each file
  POST /repos/{owner}/{repo}/git/blobs
  → Returns SHA for each blob

Step 2: Create a tree containing all blobs
  POST /repos/{owner}/{repo}/git/trees
  → Returns tree SHA

Step 3: Create a commit pointing to the tree
  POST /repos/{owner}/{repo}/git/commits
  → Returns commit SHA

Step 4: Update the branch ref to the new commit
  PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}
  → Branch now points to new commit
```

### CodeSync Commit Structure

```
Each sync creates a single atomic commit containing:

root/
├── {difficulty}/{problem-slug}/
│   ├── solution.{ext}     ← The accepted code
│   └── README.md           ← Problem description, stats
└── README.md               ← Updated root stats table
```

---

## Implementation Patterns

### Pattern 1: Complete Trees API Client

```typescript
// src/github/client.ts

interface GitHubBlob {
  sha: string;
  url: string;
}

interface GitHubTree {
  sha: string;
  tree: Array<{ path: string; mode: string; type: string; sha: string }>;
}

interface GitHubCommit {
  sha: string;
  message: string;
}

class GitHubTreesClient {
  private readonly baseUrl = 'https://api.github.com';
  
  constructor(
    private token: string,
    private owner: string,
    private repo: string
  ) {}
  
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new GitHubAPIError(
        response.status,
        error.message || response.statusText,
        path
      );
    }
    
    return response.json();
  }
  
  // Step 1: Create a blob (file content)
  async createBlob(content: string, encoding: 'utf-8' | 'base64' = 'utf-8'): Promise<string> {
    const blob = await this.request<GitHubBlob>(
      'POST',
      `/repos/${this.owner}/${this.repo}/git/blobs`,
      { content, encoding }
    );
    return blob.sha;
  }
  
  // Step 2: Get the current branch SHA
  async getBranchSHA(branch = 'main'): Promise<string> {
    const ref = await this.request<{ object: { sha: string } }>(
      'GET',
      `/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`
    );
    return ref.object.sha;
  }
  
  // Step 3: Get the tree SHA for the current commit
  async getCommitTreeSHA(commitSHA: string): Promise<string> {
    const commit = await this.request<{ tree: { sha: string } }>(
      'GET',
      `/repos/${this.owner}/${this.repo}/git/commits/${commitSHA}`
    );
    return commit.tree.sha;
  }
  
  // Step 4: Create a new tree with file changes
  async createTree(
    baseTreeSHA: string,
    files: Array<{ path: string; content: string }>
  ): Promise<string> {
    // Create blobs for all files
    const treeItems = await Promise.all(
      files.map(async (file) => ({
        path: file.path,
        mode: '100644' as const, // Regular file
        type: 'blob' as const,
        sha: await this.createBlob(file.content),
      }))
    );
    
    const tree = await this.request<GitHubTree>(
      'POST',
      `/repos/${this.owner}/${this.repo}/git/trees`,
      {
        base_tree: baseTreeSHA,
        tree: treeItems,
      }
    );
    
    return tree.sha;
  }
  
  // Step 5: Create a commit
  async createCommit(
    message: string,
    treeSHA: string,
    parentSHA: string
  ): Promise<string> {
    const commit = await this.request<GitHubCommit>(
      'POST',
      `/repos/${this.owner}/${this.repo}/git/commits`,
      {
        message,
        tree: treeSHA,
        parents: [parentSHA],
      }
    );
    return commit.sha;
  }
  
  // Step 6: Update branch reference
  async updateRef(branch: string, commitSHA: string): Promise<void> {
    await this.request(
      'PATCH',
      `/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`,
      {
        sha: commitSHA,
        force: false, // Don't force-push
      }
    );
  }
  
  // ========================================
  // High-level: Push files in a single commit
  // ========================================
  async pushFiles(
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
    branch = 'main'
  ): Promise<string> {
    // 1. Get current branch state
    const branchSHA = await this.getBranchSHA(branch);
    const baseTreeSHA = await this.getCommitTreeSHA(branchSHA);
    
    // 2. Create tree with all files
    const newTreeSHA = await this.createTree(baseTreeSHA, files);
    
    // 3. Create commit
    const commitSHA = await this.createCommit(commitMessage, newTreeSHA, branchSHA);
    
    // 4. Update branch
    await this.updateRef(branch, commitSHA);
    
    console.log(`[CodeSync] Pushed commit ${commitSHA.substring(0, 7)}: ${commitMessage}`);
    return commitSHA;
  }
}

class GitHubAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public path: string
  ) {
    super(`GitHub API ${status}: ${message} (${path})`);
    this.name = 'GitHubAPIError';
  }
}
```

### Pattern 2: File Path Generation

```typescript
// src/queue/paths.ts

interface FilePathConfig {
  structure: 'difficulty' | 'topic' | 'language' | 'flat';
  problem: {
    titleSlug: string;
    difficulty: string;
    topics?: string[];
  };
  language: string;
}

function generateFilePath(config: FilePathConfig): string {
  const ext = getFileExtension(config.language);
  const slug = config.problem.titleSlug;
  
  switch (config.structure) {
    case 'difficulty':
      return `${config.problem.difficulty}/${slug}/solution.${ext}`;
    
    case 'topic':
      const topic = config.problem.topics?.[0] || 'uncategorized';
      return `${topic}/${slug}/solution.${ext}`;
    
    case 'language':
      return `${config.language}/${slug}/solution.${ext}`;
    
    case 'flat':
      return `${slug}/solution.${ext}`;
    
    default:
      return `${slug}/solution.${ext}`;
  }
}

function getFileExtension(language: string): string {
  const lang = language.toLowerCase().trim();
  const map: Record<string, string> = {
    'c++': 'cpp', 'cpp': 'cpp',
    'javascript': 'js', 'js': 'js',
    'typescript': 'ts', 'ts': 'ts',
    'python': 'py', 'python3': 'py', 'py': 'py',
    'java': 'java',
    'go': 'go', 'golang': 'go',
    'rust': 'rs', 'rs': 'rs',
    'c#': 'cs', 'csharp': 'cs', 'cs': 'cs',
    'c': 'c',
    'ruby': 'rb',
    'swift': 'swift',
    'kotlin': 'kt',
    'scala': 'scala',
    'php': 'php',
    'dart': 'dart',
  };
  
  for (const [key, ext] of Object.entries(map)) {
    if (lang.includes(key) || lang === key) return ext;
  }
  return 'txt';
}
```

### Pattern 3: Problem README Generation

```typescript
function generateProblemReadme(submission: SubmissionData): string {
  const { problem, language, timestamp } = submission;
  const date = new Date(timestamp).toISOString().split('T')[0];
  
  return [
    `# ${problem.title}`,
    '',
    `| Detail | Value |`,
    `|--------|-------|`,
    `| **Difficulty** | ${problem.difficulty} |`,
    `| **Language** | ${language} |`,
    `| **Date Solved** | ${date} |`,
    `| **LeetCode Link** | [View Problem](https://leetcode.com/problems/${problem.titleSlug}/) |`,
    '',
    '## Solution',
    '',
    '```' + language.toLowerCase(),
    submission.code,
    '```',
    '',
  ].join('\n');
}
```

---

## Checklists

### Trees API Usage Checklist

- [ ] Token has `repo` scope
- [ ] Owner/repo parsed correctly from selection
- [ ] Branch SHA fetched before creating tree
- [ ] All files included in single tree (atomic)
- [ ] Blob encoding set correctly (utf-8 for text)
- [ ] Commit message follows convention
- [ ] Force push disabled (no data loss)
- [ ] API errors wrapped in typed GitHubAPIError
- [ ] Rate limit headers checked (X-RateLimit-Remaining)
- [ ] 409 Conflict handled (branch updated by someone else)

---

## Anti-Patterns

### ✗ One Commit Per File

```typescript
// BAD — N API calls, N commits for N files
for (const file of files) {
  await github.pushSingleFile(file.path, file.content, 'Add file');
}

// GOOD — Single atomic commit for all files
await github.pushFiles(files, 'feat(solve): Two Sum');
```

### ✗ Not Handling Branch Conflicts

```typescript
// BAD — 409 error crashes the sync
await github.updateRef(branch, commitSHA);

// GOOD — retry with fresh base
try {
  await github.updateRef(branch, commitSHA);
} catch (error) {
  if (error.status === 409) {
    console.log('[CodeSync] Branch conflict — retrying with fresh base');
    return github.pushFiles(files, message, branch); // Retry
  }
  throw error;
}
```

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| 401 Unauthorized | Token invalid or expired | Re-authenticate, check token scope |
| 404 Not Found | Wrong owner/repo or branch | Verify repository exists and is accessible |
| 409 Conflict | Branch updated by another commit | Retry with fresh branch SHA |
| 422 Unprocessable | Invalid tree structure or blob | Check file paths and content encoding |
| 403 Rate Limited | Too many API calls | Check X-RateLimit-Reset header, wait |
| Empty commit | Tree SHA same as base tree | File content unchanged |

---

## References

- [Git Trees API](https://docs.github.com/en/rest/git/trees)
- [Git Blobs API](https://docs.github.com/en/rest/git/blobs)
- [Git Commits API](https://docs.github.com/en/rest/git/commits)
- [Git References API](https://docs.github.com/en/rest/git/refs)
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/rate-limit)

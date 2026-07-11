---
name: repo-management
description: GitHub repository management, branch strategies, and repo initialization for CodeSync's target repositories.
---

# Repository Management — Initialization, Branches & Configuration

## Purpose & Scope

Use this skill when managing GitHub repositories that CodeSync pushes to, including initialization, branch selection, and repo listing/filtering.

---

## Implementation Patterns

### Pattern 1: Repository Listing and Filtering

```typescript
export async function fetchUserRepos(token: string): Promise<RepoInfo[]> {
  const allRepos: RepoInfo[] = [];
  let page = 1;
  
  while (page <= 10) { // Safety limit
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } }
    );
    
    if (!res.ok) break;
    const batch = await res.json();
    if (batch.length === 0) break;
    
    allRepos.push(...batch.map((r: any) => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      defaultBranch: r.default_branch,
      description: r.description,
      pushedAt: r.pushed_at,
    })));
    
    page++;
  }
  
  return allRepos;
}
```

### Pattern 2: Repository Initialization

```typescript
export async function initializeRepo(
  token: string, owner: string, repo: string
): Promise<void> {
  const client = new GitHubTreesClient(token, owner, repo);
  
  const readme = [
    `# ${repo}`,
    '',
    'This repository contains my coding solutions, automatically synced by [CodeSync](https://github.com/pardeep1916P/codeSync).',
    '',
    '## Stats',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    '| Total Problems | 0 |',
    '| Easy | 0 |',
    '| Medium | 0 |',
    '| Hard | 0 |',
  ].join('\n');
  
  await client.pushFiles(
    [{ path: 'README.md', content: readme }],
    'feat: initialize repository with CodeSync'
  );
}
```

### Pattern 3: Branch Detection

```typescript
export async function getDefaultBranch(
  token: string, owner: string, repo: string
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
  });
  
  if (!res.ok) throw new Error(`Failed to fetch repo: ${res.status}`);
  
  const data = await res.json();
  return data.default_branch || 'main';
}
```

---

## Checklists

- [ ] Repository exists and is accessible with token
- [ ] Default branch detected (not hardcoded to 'main')
- [ ] Repo initialized with README if empty
- [ ] Owner parsed correctly from `owner/repo` format
- [ ] Private repos handled (token must have `repo` scope)

---

## References

- [GitHub Repos API](https://docs.github.com/en/rest/repos)
- [List Repos for User](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user)

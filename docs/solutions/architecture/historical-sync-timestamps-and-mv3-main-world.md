# Solution Note: Historical Sync Timestamps, Main-World Interception & Speed Optimizations

## Context
CodeSync v1.2 introduced Historical Submissions Sync and Multi-Platform compatibility. During testing and user verification, three core technical challenges emerged:
1. **GitHub Commit Date Defaulting**: Historical submissions committed to GitHub appeared as "committed just now" instead of reflecting the actual historical solve date and lighting up the user's contribution activity graph.
2. **Timing Races in SPA Network Interception**: Injecting dynamic `<script>` elements at runtime suffered race conditions where LeetCode's SPA cached `window.fetch` prior to patch execution.
3. **Storage Collision & Queue Throughput**: Persistent storage sets locked out re-syncing of historical submissions, and un-memoized HTML parsing added unnecessary latency.

---

## Technical Solutions & Architecture Decisions

### 1. Explicit Dual Git Commit Timestamps (`author.date` & `committer.date`)
In GitHub's Git Data API (`POST /repos/{owner}/{repo}/git/commits`):
- Setting only `author.date` results in GitHub defaulting `committer.date` to `Date.now()`.
- GitHub's web UI displays commits using `committer.date` for commit listings and timeline visualizations.
- **Solution**: Explicitly set both `author` and `committer` objects with `date: payload.authorDate` (ISO 8601 string):
```ts
const commitParams: Record<string, any> = {
  message: payload.message,
  tree: payload.treeSha,
  parents: payload.parentCommitSha ? [payload.parentCommitSha] : [],
};

if (payload.authorDate) {
  const authorIdentity = {
    name: user.name || user.login,
    email: user.email || `${user.login}@users.noreply.github.com`,
    date: payload.authorDate,
  };
  commitParams.author = authorIdentity;
  commitParams.committer = authorIdentity;
}
```

### 2. Native Manifest V3 MAIN World Interception
- Instead of DOM script injection (`document.createElement('script')`), register `interceptor.js` natively in `public/manifest.json`:
```json
{
  "matches": ["https://leetcode.com/*", "https://leetcode.cn/*"],
  "js": ["interceptor.js"],
  "world": "MAIN",
  "run_at": "document_start"
}
```
- Guarantees execution in the page context before any application bundles run, with zero CSP violations.

### 3. Question Metadata Pre-Caching via GraphQL Interception
- `interceptor.ts` intercepts the problem's initial GraphQL `questionTitle` query and broadcasts `CODESYNC_QUESTION_METADATA`.
- `content.js` caches question metadata in a fast O(1) `LRUCache`.
- When the submission is accepted, question details are immediately available in memory (<10ms), bypassing subsequent GraphQL queries.

### 4. Modular Multi-Platform Adapters (`src/platforms/`)
- Unified `PlatformAdapter` interface abstracting platform-specific languages, file extensions, and slug normalization for LeetCode, Codeforces, HackerRank, and GeeksforGeeks.

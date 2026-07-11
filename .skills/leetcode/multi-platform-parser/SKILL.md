---
name: multi-platform-parser
description: Architecture for supporting multiple coding platforms (GeeksforGeeks, HackerRank, Codeforces, CodeChef) in CodeSync.
---

# Multi-Platform Parser — Cross-Platform Submission Detection

## Purpose & Scope

Use this skill when extending CodeSync to support platforms beyond LeetCode (Phase 4-7). Covers platform-specific detection strategies, unified submission interfaces, and content script architecture for multiple sites.

---

## Architecture & Concepts

### Platform Abstraction Layer

```typescript
// src/platforms/types.ts

interface PlatformParser {
  name: string;
  matchPatterns: string[];  // URL patterns for content script
  
  // Detection strategy
  detectSubmission(): Observable<RawSubmission>;
  
  // Data extraction
  extractDetails(raw: RawSubmission): Promise<NormalizedSubmission>;
}

interface NormalizedSubmission {
  id: string;
  platform: 'leetcode' | 'gfg' | 'hackerrank' | 'codeforces' | 'codechef';
  problem: {
    title: string;
    titleSlug: string;
    difficulty: string;
    url: string;
  };
  language: string;
  code: string;
  timestamp: number;
}
```

### Platform Detection Strategies

| Platform | Detection Method | API Available | Auth |
|----------|-----------------|---------------|------|
| LeetCode | GraphQL interception | GraphQL | Cookie |
| GeeksforGeeks | DOM observation | REST (limited) | Cookie |
| HackerRank | XHR interception | REST | Cookie |
| Codeforces | DOM observation | REST (public) | Cookie |
| CodeChef | XHR interception | REST | Cookie |

---

## Implementation Patterns

### Pattern: Platform Registry

```typescript
// src/platforms/registry.ts

const platforms = new Map<string, PlatformParser>();

export function registerPlatform(parser: PlatformParser): void {
  platforms.set(parser.name, parser);
}

export function getPlatformForUrl(url: string): PlatformParser | null {
  for (const parser of platforms.values()) {
    if (parser.matchPatterns.some(pattern => new URLPattern(pattern).test(url))) {
      return parser;
    }
  }
  return null;
}

// Register all platforms
registerPlatform(new LeetCodeParser());
// Phase 4+:
// registerPlatform(new GfgParser());
// registerPlatform(new HackerRankParser());
```

---

## Checklists

- [ ] Each platform has its own content script
- [ ] Submissions normalized to common interface
- [ ] Platform-specific permissions are optional
- [ ] Platform field included in commit metadata
- [ ] Folder structure supports platform prefix
- [ ] Tests cover each platform parser independently

---

## References

- [URL Pattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)

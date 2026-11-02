---
name: codesync-platform-adapter
description: Guide for creating, extending, and testing competitive programming platform adapters (LeetCode, Codeforces, HackerRank, GeeksforGeeks, CodeChef) in CodeSync.
---

# CodeSync Platform Adapter Engineering Guide

Use this skill when implementing support for a new competitive programming platform (e.g. NeetCode, AtCoder) or modifying existing adapters in `src/platforms/`.

---

## 1. Architectural Contract

Every platform adapter must implement the `PlatformAdapter` interface defined in `src/platforms/types.ts`:

```typescript
export type PlatformId = 'leetcode' | 'codeforces' | 'hackerrank' | 'geeksforgeeks' | 'codechef' | 'neetcode';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | string;

export interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  description: string;
  tags: string[];
  url: string;
  platform?: PlatformId;
}

export interface Submission {
  id: string;
  problem: Problem;
  language: string;
  code: string;
  timestamp: number;
  status: 'ACCEPTED' | 'FAILED' | 'PENDING';
  platform?: PlatformId;
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly name: string;
  readonly domainPatterns: RegExp[];
  
  matchesUrl(url: string): boolean;
  getFileExtension(language: string): string;
}
```

---

## 2. Difficulty Normalization Standard

To maintain uniform directory organization (`{platform}/{difficulty}/{slug}/`) and consistent badges across platforms, all platform ratings and division tags must be normalized to:
- **`Easy`**
- **`Medium`**
- **`Hard`**

### Normalization Reference Table
| Platform | Source Rating / Tier | Normalized Difficulty |
| :--- | :--- | :--- |
| **LeetCode** | `Easy` / `Medium` / `Hard` | Direct match |
| **Codeforces** | Rating $< 1400$ | `Easy` |
| **Codeforces** | Rating $1400 - 1899$ | `Medium` |
| **Codeforces** | Rating $\ge 1900$ | `Hard` |
| **CodeChef** | `School` or Rating $< 1400$ | `Easy` |
| **CodeChef** | `1-Star` to `3-Star` ($1400 - 1799$) | `Medium` |
| **CodeChef** | $\ge \text{4-Star}$ ($\ge 1800$) or `Challenge` | `Hard` |
| **HackerRank** | `Easy` / `Medium` / `Hard` | Direct match |
| **GeeksforGeeks** | `Basic`, `Easy` $\rightarrow$ `Easy`<br/>`Medium` $\rightarrow$ `Medium`<br/>`Hard` $\rightarrow$ `Hard` | Mapped |

---

## 3. Language & File Extension Mapping

Each adapter must correctly map platform-specific language names to standard file extensions:

```typescript
const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  // C / C++
  'c': 'c',
  'cpp': 'cpp',
  'c++': 'cpp',
  'c++14': 'cpp',
  'c++17': 'cpp',
  'c++20': 'cpp',
  'clang': 'c',
  'clang++': 'cpp',
  // Java & JVM
  'java': 'java',
  'java8': 'java',
  'java11': 'java',
  'java17': 'java',
  'kotlin': 'kt',
  'scala': 'scala',
  // Python
  'python': 'py',
  'python3': 'py',
  'py': 'py',
  'pypy': 'py',
  'pypy3': 'py',
  // Web & Scripting
  'javascript': 'js',
  'js': 'js',
  'node': 'js',
  'nodejs': 'js',
  'typescript': 'ts',
  'ts': 'ts',
  // Systems & Other
  'csharp': 'cs',
  'c#': 'cs',
  'rust': 'rs',
  'go': 'go',
  'golang': 'go',
  'swift': 'swift',
  'ruby': 'rb',
  'php': 'php',
};
```

---

## 4. Implementation Template for New Adapters

Create `src/platforms/<platform-id>/index.ts`:

```typescript
import { PlatformAdapter, PlatformId, Difficulty } from '../types';

export class NewPlatformAdapter implements PlatformAdapter {
  readonly id: PlatformId = 'newplatform' as PlatformId;
  readonly name = 'NewPlatform';
  readonly domainPatterns: RegExp[] = [
    /^https?:\/\/([a-zA-Z0-9-]+\.)?newplatform\.com/,
  ];

  matchesUrl(url: string): boolean {
    if (!url) return false;
    return this.domainPatterns.some(pattern => pattern.test(url));
  }

  normalizeDifficulty(rawDifficulty: string): Difficulty {
    const raw = (rawDifficulty || '').trim().toLowerCase();
    if (raw === 'easy') return 'Easy';
    if (raw === 'medium') return 'Medium';
    if (raw === 'hard') return 'Hard';
    return 'Medium'; // Sensible fallback
  }

  getFileExtension(language: string): string {
    const normalized = (language || '').toLowerCase().trim();
    return LANGUAGE_EXTENSION_MAP[normalized] || 'txt';
  }
}
```

---

## 5. Adapter Registration Checklist

When adding or updating an adapter:
1. [ ] Update `PlatformId` union in `src/platforms/types.ts` if adding a new platform.
2. [ ] Implement the adapter class in `src/platforms/<platform-id>/index.ts`.
3. [ ] Register the instance in `src/platforms/registry.ts`:
   ```typescript
   import { NewPlatformAdapter } from './newplatform';
   
   const platformAdapters: PlatformAdapter[] = [
     new LeetCodeAdapter(),
     new CodeforcesAdapter(),
     new HackerRankAdapter(),
     new GeeksforGeeksAdapter(),
     new CodeChefAdapter(),
     new NewPlatformAdapter(), // Add here
   ];
   ```
4. [ ] Export the adapter from `src/platforms/index.ts`.
5. [ ] Add unit tests in `src/platforms/__tests__/platforms.test.ts`.

---

## 6. Testing & Validation

Run Vitest unit tests to verify URL pattern matching and language mapping:
```bash
npm run test -- src/platforms/__tests__/platforms.test.ts
```

### Verification Test Pattern
```typescript
describe('NewPlatformAdapter', () => {
  const adapter = new NewPlatformAdapter();

  it('matches valid platform URLs', () => {
    expect(adapter.matchesUrl('https://newplatform.com/problems/two-sum')).toBe(true);
    expect(adapter.matchesUrl('https://other.com/problems/two-sum')).toBe(false);
  });

  it('correctly maps language extensions', () => {
    expect(adapter.getFileExtension('python3')).toBe('py');
    expect(adapter.getFileExtension('cpp')).toBe('cpp');
  });
});
```

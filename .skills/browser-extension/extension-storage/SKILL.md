---
name: extension-storage
description: Chrome extension storage architecture, caching strategies, quota management, and migration patterns for CodeSync.
---

# Extension Storage — Architecture, Caching & Migration

## Purpose & Scope

Use this skill when:
- Designing storage schemas for extension settings and submission data
- Implementing caching strategies for API responses
- Managing storage quotas and pruning stale data
- Migrating storage schemas between extension versions
- Debugging storage read/write issues

Do NOT use when:
- Working with GitHub API data persistence (see `github/trees-api`)
- Building UI state management (see `architecture/state-management`)
- Implementing in-memory Zustand stores (see `react-patterns`)

---

## Decision Tree

```
Storing data in the extension?
├─ What type of data?
│  ├─ User settings (token, repo, preferences)
│  │  ├─ Needs cross-device sync? → chrome.storage.sync (100KB limit)
│  │  └─ Device-local only? → chrome.storage.local (10MB limit)
│  ├─ Submission cache (code, metadata)
│  │  └─ chrome.storage.local (keyed by submission ID)
│  ├─ Temporary processing state (locks, flags)
│  │  └─ chrome.storage.session (cleared on restart)
│  └─ OAuth tokens
│     └─ chrome.storage.local (encrypted at rest by Chrome)
├─ Storage quota concerns?
│  ├─ Check usage → chrome.storage.local.getBytesInUse()
│  ├─ Near limit? → Prune oldest cached submissions
│  └─ Single item too large? → Split across keys
├─ Schema change between versions?
│  └─ Migration → onInstalled(reason: 'update') handler
└─ Need reactivity?
   └─ chrome.storage.onChanged listener
```

---

## Architecture & Concepts

### CodeSync Storage Schema

```
chrome.storage.local
│
├── settings: Settings
│   ├── githubToken: string         (PAT or OAuth token)
│   ├── selectedRepo: string        (owner/repo)
│   ├── syncOnAccept: boolean       (instant sync toggle)
│   ├── commitQueue: string[]       (pending submission IDs)
│   ├── folderStructure: string     (difficulty | topic | language)
│   ├── theme: string               (amoled | catppuccin | nord | ...)
│   ├── commitPrefix: string        (custom commit message prefix)
│   └── syncInterval: number        (alarm period in minutes)
│
├── sub_{submissionId}: SubmissionData
│   ├── id: string
│   ├── problem: { title, titleSlug, difficulty }
│   ├── language: string
│   ├── code: string
│   ├── timestamp: number
│   └── platform: string            (leetcode | gfg | ...)
│
├── _oauthCache: OAuthCache
│   ├── user: { login, avatarUrl }
│   ├── repos: RepoInfo[]
│   └── cachedAt: number
│
├── _processingLock: { timestamp: number }
│
└── _schemaVersion: number          (for migrations)
```

### Storage Limits

| Storage Area | Total Limit | Per-Item Limit | Sync | Use Case |
|-------------|-------------|----------------|------|----------|
| `local` | 10 MB | ~5 MB | No | CodeSync primary storage |
| `sync` | 100 KB | 8 KB | Yes | Cross-device settings |
| `session` | 1 MB | ~1 MB | No | Temporary processing state |

### Size Estimation for CodeSync

| Data | Avg Size | 100 items | Budget |
|------|----------|-----------|--------|
| Settings object | ~500 B | 1 | 500 B |
| Submission cache (each) | ~2-5 KB | 100 | 500 KB |
| OAuth cache | ~10 KB | 1 | 10 KB |
| Processing lock | ~50 B | 1 | 50 B |
| **Total estimated** | | | **~510 KB** |

At ~5 KB per cached submission, CodeSync can safely cache ~2,000 submissions before hitting the 10 MB limit.

---

## Implementation Patterns

### Pattern 1: Storage Layer with Defaults Merging

```typescript
// src/storage/index.ts

export interface Settings {
  githubToken: string;
  selectedRepo: string;
  syncOnAccept: boolean;
  commitQueue: string[];
  folderStructure: 'difficulty' | 'topic' | 'language' | 'flat';
  theme: string;
  commitPrefix: string;
  syncInterval: number;
}

export const DEFAULT_SETTINGS: Settings = {
  githubToken: '',
  selectedRepo: '',
  syncOnAccept: false,
  commitQueue: [],
  folderStructure: 'difficulty',
  theme: 'amoled',
  commitPrefix: 'feat(solve):',
  syncInterval: 5,
};

class StorageService {
  /**
   * Read settings with safe defaults merge.
   * New keys added in updates won't be undefined.
   */
  async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.local.get('settings');
      return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    } catch (error) {
      console.error('[CodeSync:Storage] getSettings failed:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }
  
  /**
   * Partial update — merges with existing settings.
   * Only changed keys are overwritten.
   */
  async updateSettings(partial: Partial<Settings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    await chrome.storage.local.set({ settings: updated });
  }
  
  /**
   * Atomic queue operations to prevent race conditions.
   */
  async addToQueue(submissionId: string): Promise<void> {
    const settings = await this.getSettings();
    if (settings.commitQueue.includes(submissionId)) return;
    
    await this.updateSettings({
      commitQueue: [...settings.commitQueue, submissionId],
    });
  }
  
  async removeFromQueue(submissionId: string): Promise<void> {
    const settings = await this.getSettings();
    await this.updateSettings({
      commitQueue: settings.commitQueue.filter(id => id !== submissionId),
    });
  }
  
  async clearQueue(): Promise<void> {
    await this.updateSettings({ commitQueue: [] });
  }
}

export const storage = new StorageService();
```

### Pattern 2: Submission Cache with TTL

```typescript
interface CachedSubmission {
  data: SubmissionData;
  cachedAt: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getCachedSubmission(id: string): Promise<SubmissionData | null> {
  const key = `sub_${id}`;
  const result = await chrome.storage.local.get(key);
  const cached = result[key] as CachedSubmission | undefined;
  
  if (!cached) return null;
  
  // Check TTL
  if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }
  
  return cached.data;
}

async function cacheSubmission(id: string, data: SubmissionData): Promise<void> {
  const key = `sub_${id}`;
  await chrome.storage.local.set({
    [key]: { data, cachedAt: Date.now() } satisfies CachedSubmission,
  });
}
```

### Pattern 3: Storage Quota Management

```typescript
class StorageQuotaManager {
  private readonly QUOTA = 10_485_760; // 10MB
  private readonly WARNING_THRESHOLD = 0.8; // Warn at 80%
  private readonly PRUNE_THRESHOLD = 0.9;   // Prune at 90%
  
  async checkQuota(): Promise<{
    bytesUsed: number;
    percentage: number;
    needsPruning: boolean;
  }> {
    const bytesUsed = await this.getBytesUsed();
    const percentage = bytesUsed / this.QUOTA;
    
    return {
      bytesUsed,
      percentage,
      needsPruning: percentage >= this.PRUNE_THRESHOLD,
    };
  }
  
  async pruneOldSubmissions(targetBytes?: number): Promise<number> {
    const allData = await chrome.storage.local.get(null);
    
    // Find all submission cache entries
    const submissions: Array<{ key: string; cachedAt: number; size: number }> = [];
    
    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith('sub_') && typeof value === 'object') {
        submissions.push({
          key,
          cachedAt: (value as CachedSubmission).cachedAt || 0,
          size: JSON.stringify(value).length,
        });
      }
    }
    
    // Sort oldest first
    submissions.sort((a, b) => a.cachedAt - b.cachedAt);
    
    // Calculate how much to remove
    const currentUsage = await this.getBytesUsed();
    const target = targetBytes || this.QUOTA * 0.5; // Prune to 50%
    let bytesToRemove = currentUsage - target;
    
    const keysToRemove: string[] = [];
    let removedBytes = 0;
    
    for (const sub of submissions) {
      if (removedBytes >= bytesToRemove) break;
      keysToRemove.push(sub.key);
      removedBytes += sub.size;
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`[CodeSync] Pruned ${keysToRemove.length} cached submissions (${removedBytes} bytes)`);
    }
    
    return keysToRemove.length;
  }
  
  private getBytesUsed(): Promise<number> {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, resolve);
    });
  }
}
```

### Pattern 4: Schema Migration

```typescript
// src/storage/migrations.ts

interface Migration {
  version: number;
  description: string;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    migrate: (data) => data,
  },
  {
    version: 2,
    description: 'Add syncOnAccept toggle and commitPrefix',
    migrate: (data) => {
      const settings = (data.settings || {}) as Record<string, unknown>;
      return {
        ...data,
        settings: {
          ...settings,
          syncOnAccept: settings.syncOnAccept ?? false,
          commitPrefix: settings.commitPrefix ?? 'feat(solve):',
        },
        _schemaVersion: 2,
      };
    },
  },
  {
    version: 3,
    description: 'Add folderStructure and syncInterval',
    migrate: (data) => {
      const settings = (data.settings || {}) as Record<string, unknown>;
      return {
        ...data,
        settings: {
          ...settings,
          folderStructure: settings.folderStructure ?? 'difficulty',
          syncInterval: settings.syncInterval ?? 5,
        },
        _schemaVersion: 3,
      };
    },
  },
];

const CURRENT_SCHEMA_VERSION = MIGRATIONS.length;

async function runMigrations(): Promise<void> {
  const allData = await chrome.storage.local.get(null);
  const currentVersion = (allData._schemaVersion as number) || 0;
  
  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    console.log('[CodeSync] Storage schema is up to date');
    return;
  }
  
  console.log(`[CodeSync] Migrating storage from v${currentVersion} to v${CURRENT_SCHEMA_VERSION}`);
  
  let data = allData;
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      console.log(`[CodeSync] Applying migration v${migration.version}: ${migration.description}`);
      data = migration.migrate(data);
    }
  }
  
  data._schemaVersion = CURRENT_SCHEMA_VERSION;
  await chrome.storage.local.set(data);
  
  console.log('[CodeSync] Storage migration complete');
}

// Call from onInstalled handler
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    await runMigrations();
  }
});
```

### Pattern 5: Two-Phase Cached Loading (Zustand Integration)

```typescript
// src/store/index.ts — CodeSync's instant-load pattern

interface StoreState {
  settings: Settings;
  repos: RepoInfo[];
  user: GitHubUser | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

const useStore = create<StoreState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  repos: [],
  user: null,
  isLoading: true,
  isRefreshing: false,
  
  /**
   * Phase 1: Load cached data from chrome.storage INSTANTLY
   * Phase 2: Silently refresh from GitHub API in background
   */
  initialize: async () => {
    // ── Phase 1: Cached load (instant, no spinner) ──
    const settings = await storage.getSettings();
    const cached = await storage.getOAuthCache();
    
    set({
      settings,
      repos: cached?.repos || [],
      user: cached?.user || null,
      isLoading: false,  // UI renders immediately
    });
    
    // ── Phase 2: Background refresh (silent) ──
    if (settings.githubToken) {
      set({ isRefreshing: true });
      
      try {
        const [user, repos] = await Promise.all([
          fetchGitHubUser(settings.githubToken),
          fetchGitHubRepos(settings.githubToken),
        ]);
        
        set({ user, repos, isRefreshing: false });
        
        // Update cache for next load
        await storage.setOAuthCache({ user, repos, cachedAt: Date.now() });
      } catch (error) {
        console.warn('[CodeSync] Background refresh failed:', error);
        set({ isRefreshing: false });
        // Keep using cached data — don't clear on failure
      }
    }
  },
}));
```

---

## Templates

### Template: Storage Debug Utility

```typescript
// scripts/debug-storage.ts — Run from extension console

async function debugStorage(): Promise<void> {
  const allData = await chrome.storage.local.get(null);
  const bytesUsed = await new Promise<number>(resolve =>
    chrome.storage.local.getBytesInUse(null, resolve)
  );
  
  console.group('[CodeSync] Storage Debug');
  console.log('Total bytes:', bytesUsed, `(${(bytesUsed / 1048576).toFixed(2)} MB)`);
  console.log('Schema version:', allData._schemaVersion || 'not set');
  console.log('Settings:', allData.settings);
  
  // Count submissions
  const subKeys = Object.keys(allData).filter(k => k.startsWith('sub_'));
  console.log('Cached submissions:', subKeys.length);
  
  // List queue
  const queue = allData.settings?.commitQueue || [];
  console.log('Pending queue:', queue.length, 'items');
  queue.forEach((id: string) => {
    const sub = allData[`sub_${id}`];
    console.log(`  - ${id}: ${sub?.data?.problem?.title || 'unknown'}`);
  });
  
  console.groupEnd();
}

// Expose for console access
(globalThis as any).debugStorage = debugStorage;
```

---

## Checklists

### Storage Implementation Checklist

- [ ] Settings always merged with DEFAULT_SETTINGS on read
- [ ] Schema version tracked in storage (`_schemaVersion`)
- [ ] Migrations run on extension update (`onInstalled`)
- [ ] Storage quota monitored with pruning strategy
- [ ] Submission cache entries have TTL
- [ ] Queue operations are atomic (read-modify-write with locks)
- [ ] OAuth cache has `cachedAt` timestamp
- [ ] Sensitive data (tokens) only in `chrome.storage.local` (encrypted at rest)
- [ ] No secrets in `chrome.storage.sync` (readable on other devices)
- [ ] `onChanged` listeners set up for cross-context reactivity
- [ ] Error handling on all storage operations

---

## Anti-Patterns

### ✗ Reading Settings Without Defaults

```typescript
// BAD — new keys are undefined after update
const result = await chrome.storage.local.get('settings');
const theme = result.settings.theme; // ✗ undefined if key doesn't exist

// GOOD — merge with defaults
const result = await chrome.storage.local.get('settings');
const settings = { ...DEFAULT_SETTINGS, ...result.settings };
const theme = settings.theme; // ✓ Always has a value
```

### ✗ Race Condition in Queue Updates

```typescript
// BAD — concurrent reads/writes can lose data
async function addToQueue(id: string) {
  const settings = await storage.getSettings();
  settings.commitQueue.push(id); // Another call may have added between read and write
  await storage.updateSettings(settings);
}

// GOOD — use sequential promise chain or locking
private enqueueChain = Promise.resolve();

async enqueue(id: string) {
  this.enqueueChain = this.enqueueChain.then(async () => {
    const settings = await storage.getSettings();
    if (!settings.commitQueue.includes(id)) {
      await storage.updateSettings({
        commitQueue: [...settings.commitQueue, id],
      });
    }
  });
  return this.enqueueChain;
}
```

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| Settings lost after update | No defaults merge | Use `{ ...DEFAULT_SETTINGS, ...stored }` |
| `QUOTA_BYTES_PER_ITEM exceeded` | Single value too large | Split across keys or compress |
| Storage quota exceeded | Too many cached submissions | Implement pruning with TTL |
| Data inconsistent across popup/background | Race condition | Use sequential promise chain |
| OAuth data disappears | Cache not persisted | Store in `chrome.storage.local` |
| New settings key is `undefined` | Not in migration | Add migration for new schema version |

---

## References

- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Storage Best Practices](https://developer.chrome.com/docs/extensions/develop/concepts/storage)
- [Data Storage Comparison](https://developer.chrome.com/docs/extensions/develop/concepts/storage#comparison)

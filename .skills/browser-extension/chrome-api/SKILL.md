---
name: chrome-api
description: Chrome Extension API usage patterns, best practices, and error handling for storage, alarms, notifications, tabs, and runtime APIs in CodeSync.
---

# Chrome Extension APIs — Usage Patterns & Error Handling

## Purpose & Scope

Use this skill when:
- Using any `chrome.*` API in the CodeSync extension
- Handling API errors and `chrome.runtime.lastError`
- Choosing between callback and Promise-based API patterns
- Working with chrome.storage, chrome.alarms, chrome.notifications, or chrome.tabs
- Implementing cross-context communication with chrome.runtime

Do NOT use when:
- Working on MAIN world page scripts (no chrome.* access there)
- Designing the manifest structure (see `manifest-v3`)
- Building React UI components (see `popup-ui`)

---

## Decision Tree

```
Which chrome.* API do you need?
├─ Persisting data?
│  ├─ Small config/settings → chrome.storage.sync (100KB limit, syncs)
│  ├─ Large data/cache → chrome.storage.local (10MB limit, local only)
│  └─ Session-only data → chrome.storage.session (1MB, cleared on restart)
├─ Scheduling tasks?
│  ├─ Periodic → chrome.alarms.create({ periodInMinutes })
│  ├─ One-shot delay → chrome.alarms.create({ delayInMinutes })
│  └─ Need <1 minute? → Not possible with alarms (min: 1 min)
├─ Showing notifications?
│  └─ chrome.notifications.create() with PNG iconUrl
├─ Opening/managing tabs?
│  ├─ Open new tab → chrome.tabs.create({ url })
│  ├─ Query tabs → chrome.tabs.query({ url: pattern })
│  └─ Send message to tab → chrome.tabs.sendMessage(tabId, msg)
├─ Messaging?
│  ├─ Content → Background → chrome.runtime.sendMessage()
│  ├─ Background → Content → chrome.tabs.sendMessage(tabId)
│  ├─ Background → Popup → chrome.runtime.sendMessage()
│  └─ Need persistent channel? → chrome.runtime.connect() (port)
└─ Error handling?
   ├─ Callback API → Check chrome.runtime.lastError inside callback
   ├─ Promise API → try/catch around await
   └─ sendMessage → .catch() for when no listener exists
```

---

## Architecture & Concepts

### API Promise vs Callback Patterns

Chrome MV3 supports both patterns. CodeSync uses Promises exclusively:

```typescript
// Callback pattern (legacy)
chrome.storage.local.get(['settings'], (result) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError.message);
    return;
  }
  console.log(result.settings);
});

// Promise pattern (modern, preferred in CodeSync)
try {
  const result = await chrome.storage.local.get(['settings']);
  console.log(result.settings);
} catch (error) {
  console.error('Storage error:', error);
}
```

### CodeSync API Usage Map

```
chrome.storage.local
├── settings (user configuration, GitHub token, repo selection)
├── sub_{id} (cached submission data per submission ID)
├── _processingLock (mutex for queue processing)
└── _oauthCache (cached OAuth user/repo data)

chrome.storage.sync
└── (reserved for future cross-device settings sync)

chrome.alarms
└── process-queue-alarm (5-minute periodic queue check)

chrome.notifications
├── sync_{timestamp} (sync success/failure notifications)
└── queued_{timestamp} (submission queued notifications)

chrome.runtime
├── onInstalled (extension lifecycle)
├── onMessage (cross-context messaging)
└── sendMessage (send to background/popup)

chrome.tabs
├── create (open OAuth redirect page)
└── query (find existing options tab)
```

---

## Implementation Patterns

### Pattern 1: Storage Operations with Error Handling

```typescript
// src/storage/index.ts — CodeSync storage patterns

interface Settings {
  githubToken: string;
  selectedRepo: string;
  syncOnAccept: boolean;
  commitQueue: string[];
  folderStructure: string;
  theme: string;
}

const DEFAULT_SETTINGS: Settings = {
  githubToken: '',
  selectedRepo: '',
  syncOnAccept: false,
  commitQueue: [],
  folderStructure: 'difficulty',
  theme: 'amoled',
};

class Storage {
  // Read settings with defaults merge
  async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.local.get('settings');
      return { ...DEFAULT_SETTINGS, ...result.settings };
    } catch (error) {
      console.error('[CodeSync] Failed to read settings:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }
  
  // Partial update (merge, not replace)
  async updateSettings(partial: Partial<Settings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    
    try {
      await chrome.storage.local.set({ settings: updated });
    } catch (error) {
      console.error('[CodeSync] Failed to save settings:', error);
      throw error;
    }
  }
  
  // Read a specific submission cache entry
  async getSubmission(id: string): Promise<SubmissionData | null> {
    try {
      const key = `sub_${id}`;
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error('[CodeSync] Failed to read submission:', error);
      return null;
    }
  }
  
  // Store submission data
  async saveSubmission(id: string, data: SubmissionData): Promise<void> {
    const key = `sub_${id}`;
    await chrome.storage.local.set({ [key]: data });
  }
  
  // Remove submission data
  async removeSubmission(id: string): Promise<void> {
    await chrome.storage.local.remove(`sub_${id}`);
  }
  
  // Initialize default settings (first install only)
  async initializeDefaults(): Promise<void> {
    const existing = await chrome.storage.local.get('settings');
    if (!existing.settings) {
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
  }
  
  // Get storage usage stats
  async getStorageUsage(): Promise<{ bytesUsed: number; quota: number }> {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesUsed) => {
        resolve({
          bytesUsed,
          quota: chrome.storage.local.QUOTA_BYTES || 10_485_760 // 10MB default
        });
      });
    });
  }
}

export const storage = new Storage();
```

### Pattern 2: Notifications with PNG Icons

```typescript
// Chrome notifications require PNG icons — SVG data URLs cause crashes

const NOTIFICATION_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAA'
  + 'AgCAYAAABzenr0AAAALUlEQVR42u3SQREAAAgEoNu/tDl2sg9+CGB55VJRAAMECC'
  + 'AgQIAAAQIECBAgQIAZbx4J87rD/4gAAAAASUVORK5CYII=';

function showNotification(
  id: string,
  title: string,
  message: string,
  priority: 0 | 1 | 2 = 1
): void {
  if (!chrome.notifications?.create) return;
  
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: NOTIFICATION_ICON,
    title,
    message,
    priority,
  }, () => {
    // CRITICAL: Must check lastError inside callback
    // to suppress "Unable to download all specified images" errors
    if (chrome.runtime.lastError) {
      console.warn('[CodeSync] Notification error:', chrome.runtime.lastError.message);
    }
  });
}

// Auto-dismiss after delay
function showTimedNotification(title: string, message: string, durationMs = 5000): void {
  const id = `codesync_${Date.now()}`;
  showNotification(id, title, message);
  
  setTimeout(() => {
    chrome.notifications.clear(id, () => {
      if (chrome.runtime.lastError) {
        // Notification may already be dismissed by user
      }
    });
  }, durationMs);
}
```

### Pattern 3: Tab Management for OAuth

```typescript
// Open OAuth page, handle redirect, close tab

async function startOAuthFlow(clientId: string): Promise<string> {
  const redirectUri = chrome.identity.getRedirectURL();
  const state = crypto.randomUUID();
  
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'repo');
  authUrl.searchParams.set('state', state);
  
  // Method 1: Using chrome.identity (preferred)
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true,
      },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!responseUrl) {
          reject(new Error('No response URL'));
          return;
        }
        
        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        
        if (returnedState !== state) {
          reject(new Error('State mismatch'));
          return;
        }
        
        if (!code) {
          reject(new Error('No authorization code'));
          return;
        }
        
        resolve(code);
      }
    );
  });
}

// Method 2: Manual tab management (fallback)
async function openOAuthTab(url: string): Promise<chrome.tabs.Tab> {
  // Check if options/OAuth tab already exists
  const existing = await chrome.tabs.query({ url: '*://github.com/login/oauth/*' });
  
  if (existing.length > 0) {
    // Focus existing tab
    await chrome.tabs.update(existing[0].id!, { active: true });
    return existing[0];
  }
  
  // Open new tab
  return chrome.tabs.create({ url, active: true });
}
```

### Pattern 4: Alarm Management

```typescript
class AlarmManager {
  // Create or update a periodic alarm
  async ensureAlarm(name: string, periodInMinutes: number): Promise<void> {
    const existing = await chrome.alarms.get(name);
    
    if (existing) {
      // Alarm already exists — check if period matches
      if (existing.periodInMinutes === periodInMinutes) {
        return; // No change needed
      }
      // Period changed — recreate
      await chrome.alarms.clear(name);
    }
    
    await chrome.alarms.create(name, {
      periodInMinutes: Math.max(1, periodInMinutes), // Minimum 1 minute
      delayInMinutes: 0.5, // First fire after 30 seconds
    });
    
    console.log(`[CodeSync] Alarm "${name}" set for every ${periodInMinutes} min`);
  }
  
  // List all active alarms
  async listAlarms(): Promise<chrome.alarms.Alarm[]> {
    return chrome.alarms.getAll();
  }
  
  // Clear a specific alarm
  async clearAlarm(name: string): Promise<boolean> {
    return chrome.alarms.clear(name);
  }
  
  // Clear all alarms
  async clearAll(): Promise<void> {
    await chrome.alarms.clearAll();
  }
}
```

### Pattern 5: Storage Change Listener

```typescript
// React to storage changes across contexts (popup, options, background)

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  
  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    if (key === 'settings') {
      const oldSettings = oldValue as Settings;
      const newSettings = newValue as Settings;
      
      // React to specific setting changes
      if (oldSettings?.syncOnAccept !== newSettings?.syncOnAccept) {
        console.log('[CodeSync] Sync toggle changed to:', newSettings.syncOnAccept);
      }
      
      if (oldSettings?.selectedRepo !== newSettings?.selectedRepo) {
        console.log('[CodeSync] Repository changed to:', newSettings.selectedRepo);
      }
      
      if (oldSettings?.theme !== newSettings?.theme) {
        console.log('[CodeSync] Theme changed to:', newSettings.theme);
      }
    }
  }
});
```

---

## Templates

### Template: Chrome API Error Handler Utility

```typescript
// src/utils/chrome-errors.ts

export function checkLastError(context: string): Error | null {
  if (chrome.runtime.lastError) {
    const error = new Error(`[CodeSync:${context}] ${chrome.runtime.lastError.message}`);
    console.warn(error.message);
    return error;
  }
  return null;
}

export async function safeStorageGet<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) ?? null;
  } catch (error) {
    console.error(`[CodeSync] storage.get("${key}") failed:`, error);
    return null;
  }
}

export async function safeStorageSet(items: Record<string, unknown>): Promise<boolean> {
  try {
    await chrome.storage.local.set(items);
    return true;
  } catch (error) {
    console.error('[CodeSync] storage.set failed:', error);
    return false;
  }
}

export async function safeSendMessage(message: unknown): Promise<unknown> {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    // Suppress "no receiver" errors when popup/options are closed
    if ((error as Error).message?.includes('Receiving end does not exist')) {
      return null;
    }
    throw error;
  }
}
```

---

## Checklists

### Chrome API Usage Checklist

- [ ] `chrome.runtime.lastError` checked in ALL callback-based API calls
- [ ] Promise-based API calls wrapped in try/catch
- [ ] `sendMessage` calls have `.catch()` for when no listener exists
- [ ] Storage reads merge with defaults for missing keys
- [ ] Notifications use PNG icons (not SVG)
- [ ] Alarms have minimum period of 1 minute
- [ ] `tabs.create` checks for existing tab before opening duplicate
- [ ] Permissions declared in manifest match APIs used
- [ ] No synchronous chrome.* calls blocking the main thread
- [ ] Storage writes batched where possible (one `.set()` call)

---

## Anti-Patterns

### ✗ Not Checking chrome.runtime.lastError

```typescript
// BAD — unhandled error leaks to console
chrome.notifications.create('id', options);

// GOOD — check inside callback
chrome.notifications.create('id', options, () => {
  if (chrome.runtime.lastError) {
    console.warn('Notification error:', chrome.runtime.lastError.message);
  }
});
```

### ✗ Ignoring Storage Quota

```typescript
// BAD — storing unbounded data
async function cacheAllSubmissions(submissions: unknown[]) {
  // Could exceed 10MB limit
  await chrome.storage.local.set({ allSubmissions: submissions });
}

// GOOD — manage storage budget
async function cacheSubmission(id: string, data: unknown) {
  const usage = await chrome.storage.local.getBytesInUse(null);
  const quota = chrome.storage.local.QUOTA_BYTES;
  
  if (usage > quota * 0.9) {
    await pruneOldestCachedSubmissions();
  }
  
  await chrome.storage.local.set({ [`sub_${id}`]: data });
}
```

### ✗ Using storage.sync for Large Data

```typescript
// BAD — sync storage has 100KB total limit, 8KB per item
await chrome.storage.sync.set({ submissions: largeArray });

// GOOD — use local storage for large data, sync for small settings
await chrome.storage.local.set({ submissions: largeArray });
await chrome.storage.sync.set({ theme: 'amoled' }); // Tiny config
```

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Uncaught Error: Unable to download all specified images` | SVG data URL in notification icon | Use PNG data URL |
| `Receiving end does not exist` | No listener when popup/options are closed | `.catch()` on sendMessage |
| `QUOTA_BYTES_PER_ITEM quota exceeded` | Single storage item too large | Split data across multiple keys |
| Alarm doesn't fire | Period < 1 minute or permission missing | Use ≥1 min, add `alarms` permission |
| `Cannot read properties of undefined` on storage read | Key doesn't exist in storage | Merge with defaults on read |
| Notification not showing on Windows | iconUrl invalid or system notifications disabled | Use valid PNG data URL, check OS settings |
| Storage changes not reflected in popup | Not listening to `storage.onChanged` | Add `onChanged` listener |

---

## References

- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [chrome.notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications)
- [chrome.tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [chrome.runtime API](https://developer.chrome.com/docs/extensions/reference/api/runtime)
- [chrome.identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Error Handling Best Practices](https://developer.chrome.com/docs/extensions/develop/concepts/error-handling)

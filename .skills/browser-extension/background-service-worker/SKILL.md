---
name: background-service-worker
description: Background service worker architecture, lifecycle management, alarm scheduling, and message handling for the CodeSync Chrome extension.
---

# Background Service Worker — Architecture & Lifecycle

## Purpose & Scope

Use this skill when:
- Creating or modifying the background service worker (`src/background/index.ts`)
- Setting up periodic alarms for queue processing
- Handling messages from content scripts or popup/options pages
- Managing the extension installation and update lifecycle
- Debugging service worker termination and wake-up issues

Do NOT use when:
- Writing content script injection logic (see `content-scripts`)
- Building popup or options UI (see `popup-ui`)
- Working on GitHub API calls directly (see `github/trees-api`)

---

## Decision Tree

```
Working on background logic?
├─ Handling extension lifecycle events?
│  ├─ First install → chrome.runtime.onInstalled (reason: "install")
│  ├─ Extension update → chrome.runtime.onInstalled (reason: "update")
│  └─ Chrome update → chrome.runtime.onInstalled (reason: "chrome_update")
├─ Need periodic task?
│  ├─ Exact interval? → chrome.alarms.create({ periodInMinutes })
│  ├─ One-shot delay? → chrome.alarms.create({ delayInMinutes })
│  └─ Complex schedule? → Multiple named alarms
├─ Receiving messages?
│  ├─ From content script? → chrome.runtime.onMessage
│  ├─ From popup? → chrome.runtime.onMessage
│  ├─ From other extension? → chrome.runtime.onMessageExternal
│  └─ Need response? → Return true + sendResponse()
├─ Service worker dying?
│  ├─ Long-running task? → Break into chunks or use alarms
│  ├─ Lost state? → Persist to chrome.storage
│  └─ WebSocket needed? → Use offscreen document (MV3)
└─ Debugging?
   ├─ Check chrome://serviceworker-internals
   ├─ Check chrome://extensions → service worker link
   └─ Add console.log with [CodeSync] prefix
```

---

## Architecture & Concepts

### Service Worker Lifecycle in MV3

Unlike MV2 persistent background pages, MV3 service workers are **event-driven** and **ephemeral**:

```
Install/Update → onInstalled fires
                      ↓
              Worker goes IDLE
                      ↓
         Event fires (alarm, message, etc.)
                      ↓
              Worker WAKES UP
                      ↓
         Handler executes (max ~5 min)
                      ↓
              Worker goes IDLE again
                      ↓
         After ~30s idle → Worker TERMINATES
                      ↓
         Next event → Worker RESTARTS from scratch
```

**Critical implications for CodeSync:**
1. **No global state survives termination** — everything must go to `chrome.storage`
2. **No `setInterval`/`setTimeout` beyond 30s** — use `chrome.alarms` instead
3. **No WebSockets** — connection drops when worker terminates
4. **All listeners must be registered synchronously** at the top level

### CodeSync Background Architecture

```
background/index.ts
├── TOP-LEVEL LISTENER REGISTRATION (synchronous)
│   ├── chrome.runtime.onInstalled
│   ├── chrome.alarms.onAlarm
│   └── chrome.runtime.onMessage
├── onInstalled handler
│   ├── Set default settings in storage
│   └── Create periodic alarm ("process-queue-alarm")
├── onAlarm handler
│   ├── Read settings from storage
│   ├── Check if syncOnAccept is enabled
│   ├── If enabled → process pending queue
│   └── If disabled → log and skip
└── onMessage handler
    ├── SUBMISSION_DETECTED → enqueue submission
    ├── TRIGGER_SYNC → force process queue
    ├── GET_SETTINGS → return settings
    └── UPDATE_SETTINGS → save settings
```

---

## Implementation Patterns

### Pattern 1: CodeSync Service Worker Entry Point

```typescript
// src/background/index.ts
import { CommitQueue } from '../queue';
import { storage } from '../storage';

const LOG_PREFIX = '[CodeSync]';

// ============================================================
// CRITICAL: All listeners MUST be registered at the top level
// synchronously. If registered inside async callbacks or
// conditionals, they will NOT fire after worker restarts.
// ============================================================

// --- Installation & Update ---
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(LOG_PREFIX, 'Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings on first install
    await storage.initializeDefaults();
    console.log(LOG_PREFIX, 'Default settings initialized');
  }
  
  // Create or update the periodic alarm
  await chrome.alarms.create('process-queue-alarm', {
    periodInMinutes: 5,
    delayInMinutes: 1  // First fire after 1 minute
  });
  
  console.log(LOG_PREFIX, 'Queue processing alarm registered');
});

// --- Alarm Handler ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'process-queue-alarm') return;
  
  console.log(LOG_PREFIX, 'Alarm triggered: checking settings...');
  
  const settings = await storage.getSettings();
  
  if (!settings.syncOnAccept) {
    console.log(LOG_PREFIX, 'Alarm: Instant sync is OFF. Skipping auto-processing.');
    return;
  }
  
  if (!settings.githubToken || !settings.selectedRepo) {
    console.log(LOG_PREFIX, 'Alarm: GitHub not configured. Skipping.');
    return;
  }
  
  const queue = new CommitQueue(settings.githubToken);
  const pending = settings.commitQueue || [];
  
  if (pending.length === 0) {
    console.log(LOG_PREFIX, 'Alarm: No pending submissions.');
    return;
  }
  
  console.log(LOG_PREFIX, `Processing ${pending.length} pending submission(s)...`);
  await queue.processQueue(settings);
});

// --- Message Handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(LOG_PREFIX, 'Received message:', message.action);
  
  // Handle async responses by returning true
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ success: false, error: error.message }));
  
  return true; // Keep message channel open for async response
});

async function handleMessage(
  message: { action: string; payload?: unknown },
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.action) {
    case 'SUBMISSION_DETECTED':
      return handleSubmission(message.payload as SubmissionPayload);
    
    case 'TRIGGER_SYNC':
      return handleManualSync();
    
    case 'GET_SETTINGS':
      return storage.getSettings();
    
    case 'UPDATE_SETTINGS':
      await storage.updateSettings(message.payload as Partial<Settings>);
      return { success: true };
    
    default:
      console.warn(LOG_PREFIX, 'Unknown action:', message.action);
      return { success: false, error: 'Unknown action' };
  }
}
```

### Pattern 2: Submission Enqueue Handler

```typescript
async function handleSubmission(payload: SubmissionPayload): Promise<{ success: boolean }> {
  const settings = await storage.getSettings();
  
  // Store submission data
  const key = `sub_${payload.id}`;
  await chrome.storage.local.set({ [key]: payload });
  
  // Add to queue (with deduplication)
  const queue = new CommitQueue(settings.githubToken);
  await queue.enqueue(payload.id, payload);
  
  // If instant sync is enabled and GitHub is configured, process immediately
  if (settings.syncOnAccept && settings.githubToken && settings.selectedRepo) {
    console.log(LOG_PREFIX, 'Instant sync is ON. Processing immediately...');
    await queue.processQueue(settings);
  } else {
    const updatedSettings = await storage.getSettings();
    const queueLength = updatedSettings.commitQueue?.length || 0;
    console.log(LOG_PREFIX,
      `Instant sync is OFF. Submission "${payload.problem.title}" queued (${queueLength} pending).`
    );
  }
  
  return { success: true };
}
```

### Pattern 3: Manual Sync Trigger

```typescript
async function handleManualSync(): Promise<{ success: boolean; processed?: number }> {
  const settings = await storage.getSettings();
  
  if (!settings.githubToken || !settings.selectedRepo) {
    return { success: false, error: 'GitHub not configured' } as any;
  }
  
  const pending = settings.commitQueue || [];
  if (pending.length === 0) {
    return { success: true, processed: 0 };
  }
  
  const queue = new CommitQueue(settings.githubToken);
  await queue.processQueue(settings);
  
  return { success: true, processed: pending.length };
}
```

### Pattern 4: Alarm Management Utilities

```typescript
// Check if alarm exists
async function ensureAlarmExists(): Promise<void> {
  const alarm = await chrome.alarms.get('process-queue-alarm');
  if (!alarm) {
    console.log(LOG_PREFIX, 'Alarm missing — re-registering');
    await chrome.alarms.create('process-queue-alarm', {
      periodInMinutes: 5,
      delayInMinutes: 0.5
    });
  }
}

// Clear all alarms (for cleanup)
async function clearAllAlarms(): Promise<void> {
  await chrome.alarms.clearAll();
  console.log(LOG_PREFIX, 'All alarms cleared');
}

// Update alarm interval based on settings
async function updateAlarmInterval(minutes: number): Promise<void> {
  await chrome.alarms.clear('process-queue-alarm');
  await chrome.alarms.create('process-queue-alarm', {
    periodInMinutes: Math.max(1, minutes), // Minimum 1 minute
    delayInMinutes: 0.5
  });
  console.log(LOG_PREFIX, `Alarm interval updated to ${minutes} minutes`);
}
```

### Pattern 5: Handling Service Worker Restart

```typescript
// The service worker may restart at any time.
// On restart, global variables are reset. Recover state from storage.

// BAD: Global mutable state
let isProcessing = false; // ✗ Lost on restart

// GOOD: Persist processing state
async function acquireProcessingLock(): Promise<boolean> {
  const { _processingLock } = await chrome.storage.local.get('_processingLock');
  
  if (_processingLock) {
    const elapsed = Date.now() - _processingLock.timestamp;
    if (elapsed < 120_000) { // Lock valid for 2 minutes
      return false; // Already processing
    }
    // Stale lock — someone crashed, take over
  }
  
  await chrome.storage.local.set({
    _processingLock: { timestamp: Date.now() }
  });
  return true;
}

async function releaseProcessingLock(): Promise<void> {
  await chrome.storage.local.remove('_processingLock');
}
```

---

## Templates

### Template: Basic Service Worker Structure

```typescript
// Minimal service worker for a new extension feature

// 1. Synchronous listener registration
chrome.runtime.onInstalled.addListener(onInstalled);
chrome.alarms.onAlarm.addListener(onAlarm);
chrome.runtime.onMessage.addListener(onMessage);

// 2. Handler implementations
async function onInstalled(details: chrome.runtime.InstalledDetails) {
  // Initialize on first install
  // Set up alarms
}

function onAlarm(alarm: chrome.alarms.Alarm) {
  // Handle periodic tasks
}

function onMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  // Route messages to handlers
  // Return true for async responses
  return true;
}
```

### Template: Message Protocol Type Definitions

```typescript
// src/types/messages.ts

// Incoming messages (content script → background)
type IncomingMessage =
  | { action: 'SUBMISSION_DETECTED'; payload: SubmissionPayload }
  | { action: 'TRIGGER_SYNC' }
  | { action: 'GET_SETTINGS' }
  | { action: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { action: 'CLEAR_QUEUE' }
  | { action: 'DELETE_QUEUE_ITEM'; payload: { id: string } };

// Outgoing messages (background → popup/options)
type OutgoingMessage =
  | { action: 'SYNC_SUCCESS'; payload: { problemTitle: string } }
  | { action: 'SYNC_FAILED'; payload: { problemTitle: string; error: string } }
  | { action: 'SUBMISSION_QUEUED'; payload: { problemTitle: string; queueLength: number } }
  | { action: 'QUEUE_UPDATED'; payload: { queueLength: number } };

interface SubmissionPayload {
  id: string;
  problem: {
    title: string;
    titleSlug: string;
    difficulty: string;
  };
  language: string;
  code: string;
  timestamp: number;
}
```

---

## Checklists

### Service Worker Development Checklist

- [ ] All event listeners registered synchronously at top level
- [ ] No global mutable state (use `chrome.storage` instead)
- [ ] No `setInterval` / `setTimeout` beyond 30 seconds
- [ ] All async message handlers return `true` from the listener
- [ ] `sendResponse` is called in all code paths (success and error)
- [ ] Alarms have unique, descriptive names
- [ ] Alarm minimum period is ≥1 minute
- [ ] Processing lock prevents concurrent queue processing
- [ ] All errors are caught and logged with `[CodeSync]` prefix
- [ ] No unhandled promise rejections (`.catch()` on all promises)
- [ ] `chrome.runtime.lastError` checked in all API callbacks
- [ ] No `eval()`, `new Function()`, or dynamic code execution

### Service Worker Debugging Checklist

- [ ] Check `chrome://extensions` → service worker "Inspect" link
- [ ] Check `chrome://serviceworker-internals` for lifecycle state
- [ ] Verify worker restarts cleanly (kill from internals, trigger event)
- [ ] Verify alarms survive worker termination
- [ ] Verify storage state persists across restarts
- [ ] Test with DevTools closed (some bugs only appear then)

---

## Anti-Patterns

### ✗ Registering Listeners Inside Async Callbacks

```typescript
// BAD — listener registered inside async function
// After service worker restarts, this listener won't exist
async function init() {
  const settings = await chrome.storage.local.get('settings');
  if (settings.enabled) {
    chrome.runtime.onMessage.addListener(handler); // ✗ Conditional
  }
}
init();

// GOOD — register at top level, check conditions inside handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check conditions inside the handler
  chrome.storage.local.get('settings').then(({ settings }) => {
    if (!settings?.enabled) {
      sendResponse({ error: 'Extension disabled' });
      return;
    }
    // Process message...
  });
  return true;
});
```

### ✗ Using setInterval for Periodic Tasks

```typescript
// BAD — setInterval dies when service worker terminates
setInterval(() => {
  processQueue();
}, 5 * 60 * 1000);

// GOOD — use chrome.alarms
chrome.alarms.create('process-queue', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'process-queue') {
    processQueue();
  }
});
```

### ✗ Not Handling Async Responses Properly

```typescript
// BAD — sendResponse called after listener returns
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  fetch('https://api.github.com/user')
    .then(r => r.json())
    .then(data => sendResponse(data)); // ✗ Too late, channel closed
  // Missing: return true
});

// GOOD — return true to keep channel open
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  fetch('https://api.github.com/user')
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ error: err.message }));
  return true; // ✓ Keeps message channel open
});
```

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| Alarm handler never fires | Listener not at top level | Move `onAlarm.addListener` to module scope |
| Service worker stops unexpectedly | Idle timeout (~30s) | This is normal; persist state to storage |
| `sendResponse` not working | Forgot `return true` | Return `true` from `onMessage` listener |
| Global variables are `undefined` | Worker restarted | Use `chrome.storage` instead of globals |
| Multiple alarm fires at once | Duplicate alarm creation | Check alarm exists before creating |
| Worker crashes on startup | Syntax error or unhandled throw | Check `chrome://extensions` for error banner |
| Messages not received | No listener registered | Ensure listener is at top-level synchronous scope |
| `chrome.alarms.create` fails silently | `alarms` permission missing | Add `"alarms"` to manifest `permissions` |

---

## References

- [Chrome Service Workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [chrome.runtime API](https://developer.chrome.com/docs/extensions/reference/api/runtime)

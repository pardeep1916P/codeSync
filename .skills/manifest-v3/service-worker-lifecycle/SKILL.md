---
name: service-worker-lifecycle
description: Chrome MV3 service worker lifecycle management, state persistence, wake-up patterns, and termination handling for CodeSync.
---

# Service Worker Lifecycle — Wake, Execute, Terminate

## Purpose & Scope

Use this skill when:
- Debugging service worker termination issues
- Implementing state that survives worker restarts
- Understanding when and why workers terminate
- Handling long-running operations that exceed the 5-minute limit
- Setting up proper event-driven architecture

---

## Architecture & Concepts

### Lifecycle States

```
┌──────────┐     Event     ┌──────────┐    Handler    ┌──────────┐
│          │  ──────────►  │          │  ──────────►  │          │
│  STOPPED │               │  RUNNING │               │   IDLE   │
│          │  ◄──────────  │          │  ◄──────────  │          │
└──────────┘   30s idle    └──────────┘    No work    └──────────┘
                timeout                   remaining
```

### Termination Rules

| Condition | Timeout | Notes |
|-----------|---------|-------|
| No pending events | ~30 seconds | Worker goes idle |
| Active fetch/XHR | Extended | Stays alive during network |
| Message channel open | Extended | Port or pending sendResponse |
| chrome.alarms | N/A | Alarm wakes worker anew |
| Total execution | ~5 minutes | Hard limit per wake cycle |

### What Survives Termination

| Survives | Does NOT Survive |
|----------|-----------------|
| `chrome.storage.local` data | Global variables |
| `chrome.storage.session` data | `let`/`const` declarations |
| Registered event listeners | `setTimeout`/`setInterval` |
| `chrome.alarms` | Open WebSocket connections |
| Extension ID / URLs | In-memory caches |

---

## Implementation Patterns

### Pattern 1: State Recovery on Wake

```typescript
// Every time the service worker starts, it's a fresh execution.
// Recover any in-progress state from storage.

const LOG = '[CodeSync:SW]';

// This runs on every wake-up
console.log(LOG, 'Service worker started');

// Check if we were interrupted mid-processing
(async () => {
  const { _processingLock } = await chrome.storage.local.get('_processingLock');
  
  if (_processingLock) {
    const elapsed = Date.now() - _processingLock.timestamp;
    
    if (elapsed < 300_000) { // Less than 5 minutes old
      console.log(LOG, 'Detected interrupted processing — resuming');
      await resumeQueueProcessing();
    } else {
      console.log(LOG, 'Stale processing lock — clearing');
      await chrome.storage.local.remove('_processingLock');
    }
  }
})();
```

### Pattern 2: Keeping Worker Alive for Long Tasks

```typescript
// For operations that take longer than 30 seconds,
// use techniques to extend the worker lifetime.

// Technique 1: Periodic chrome.storage.session writes
async function processWithKeepAlive<T>(
  operation: () => Promise<T>,
  label: string
): Promise<T> {
  const keepAliveInterval = setInterval(async () => {
    await chrome.storage.session.set({ _keepAlive: Date.now() });
    console.log(LOG, `Keep-alive ping for: ${label}`);
  }, 25_000); // Every 25 seconds
  
  try {
    return await operation();
  } finally {
    clearInterval(keepAliveInterval);
    await chrome.storage.session.remove('_keepAlive');
  }
}

// Usage
await processWithKeepAlive(async () => {
  for (const item of queue) {
    await processItem(item);
  }
}, 'queue-processing');
```

### Pattern 3: Chunked Processing Across Wake Cycles

```typescript
// For very large queues, process in chunks across multiple alarm cycles

async function processQueueChunked(): Promise<void> {
  const settings = await storage.getSettings();
  const queue = settings.commitQueue;
  
  if (queue.length === 0) return;
  
  const CHUNK_SIZE = 3; // Process 3 items per wake cycle
  const chunk = queue.slice(0, CHUNK_SIZE);
  
  for (const id of chunk) {
    try {
      await processSubmission(id);
      await storage.removeFromQueue(id);
    } catch (error) {
      console.error(LOG, `Failed to process ${id}:`, error);
      break; // Stop on first failure, retry next cycle
    }
  }
  
  // Remaining items will be processed on next alarm
  const remaining = queue.length - chunk.length;
  if (remaining > 0) {
    console.log(LOG, `${remaining} items remaining for next cycle`);
  }
}
```

---

## Checklists

### Service Worker Lifecycle Checklist

- [ ] All event listeners registered synchronously at module scope
- [ ] No global mutable state relied upon
- [ ] Long operations use keep-alive techniques
- [ ] Processing locks stored in chrome.storage
- [ ] Stale locks detected and cleaned on restart
- [ ] Large queues processed in chunks across cycles
- [ ] No setTimeout/setInterval beyond 25 seconds
- [ ] Worker tested with manual termination (DevTools → Terminate)

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| Worker stops mid-processing | Idle timeout | Use keep-alive pattern |
| Event handler not firing | Registered inside async callback | Move to synchronous top level |
| State lost between alarms | Using global variables | Use chrome.storage |
| Worker crashes on start | Unhandled top-level error | Wrap initialization in try-catch |
| Alarm doesn't wake worker | Alarm cleared or not created | Re-create in onInstalled |

---

## References

- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Service Worker Events](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events)
- [Extending Service Worker Lifetime](https://developer.chrome.com/blog/longer-esw-lifetimes)

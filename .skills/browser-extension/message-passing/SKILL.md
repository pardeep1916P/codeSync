---
name: message-passing
description: Cross-context message passing patterns between content scripts, background workers, popup, and options pages in the CodeSync Chrome extension.
---

# Message Passing — Cross-Context Communication

## Purpose & Scope

Use this skill when:
- Sending data between content script and background service worker
- Broadcasting events from background to popup/options pages
- Implementing request-response patterns across extension contexts
- Setting up long-lived port connections for streaming data
- Debugging message delivery failures

Do NOT use when:
- Communicating within the same context (use direct function calls)
- Passing data between MAIN and ISOLATED world (use `window.postMessage`)
- Persisting data (use `chrome.storage`)

---

## Decision Tree

```
Need to communicate between contexts?
├─ One-shot message?
│  ├─ Content → Background → chrome.runtime.sendMessage()
│  ├─ Background → specific tab → chrome.tabs.sendMessage(tabId)
│  ├─ Popup → Background → chrome.runtime.sendMessage()
│  └─ Need a response? → Return true, use sendResponse / await
├─ Streaming/long-lived?
│  ├─ Use chrome.runtime.connect() to create a port
│  ├─ Port stays open until disconnect()
│  └─ Good for: real-time sync progress, live log streaming
├─ Broadcast to all contexts?
│  ├─ Background → all tabs → query tabs, send to each
│  └─ Background → popup (if open) → sendMessage with .catch()
├─ Between MAIN and ISOLATED world?
│  └─ Use window.postMessage (not chrome.runtime)
└─ Message not received?
   ├─ No listener registered? → Ensure onMessage at top level
   ├─ Popup closed? → .catch() the sendMessage
   ├─ Wrong tab? → Verify tabId
   └─ Async response? → Return true from listener
```

---

## Architecture & Concepts

### CodeSync Message Flow

```
┌──────────────┐                  ┌──────────────────┐
│  LeetCode    │  window.post     │  Content Script   │
│  Page (MAIN) │ ──────────────── │  (ISOLATED)       │
│              │  Message()       │                    │
└──────────────┘                  └────────┬───────────┘
                                           │
                              chrome.runtime.sendMessage()
                                           │
                                 ┌─────────▼──────────┐
                                 │  Background Worker  │
                                 │  (Service Worker)   │
                                 └──┬──────────────┬───┘
                                    │              │
                   chrome.runtime   │              │  chrome.runtime
                   .sendMessage()   │              │  .sendMessage()
                                    │              │
                            ┌───────▼──┐     ┌─────▼──────┐
                            │  Popup   │     │  Options   │
                            │  (React) │     │  (React)   │
                            └──────────┘     └────────────┘
```

### Message Protocol

CodeSync uses a typed message protocol with `action` and `payload`:

```typescript
// Every message has this shape
interface CodeSyncMessage<T = unknown> {
  action: string;      // e.g., 'SUBMISSION_DETECTED'
  payload?: T;         // action-specific data
  requestId?: string;  // for request-response correlation
}
```

---

## Implementation Patterns

### Pattern 1: Typed Message Protocol

```typescript
// src/types/messages.ts

// ============================================================
// Messages: Content Script → Background
// ============================================================
export interface SubmissionDetectedMessage {
  action: 'SUBMISSION_DETECTED';
  payload: {
    id: string;
    problem: { title: string; titleSlug: string; difficulty: string };
    language: string;
    code: string;
    timestamp: number;
  };
}

// ============================================================
// Messages: Popup/Options → Background
// ============================================================
export interface TriggerSyncMessage {
  action: 'TRIGGER_SYNC';
}

export interface GetSettingsMessage {
  action: 'GET_SETTINGS';
}

export interface UpdateSettingsMessage {
  action: 'UPDATE_SETTINGS';
  payload: Partial<Settings>;
}

export interface DeleteQueueItemMessage {
  action: 'DELETE_QUEUE_ITEM';
  payload: { id: string };
}

export interface ClearQueueMessage {
  action: 'CLEAR_QUEUE';
}

// ============================================================
// Messages: Background → Popup/Options (notifications)
// ============================================================
export interface SyncSuccessMessage {
  action: 'SYNC_SUCCESS';
  payload: { problemTitle: string };
}

export interface SyncFailedMessage {
  action: 'SYNC_FAILED';
  payload: { problemTitle: string; error: string };
}

export interface SubmissionQueuedMessage {
  action: 'SUBMISSION_QUEUED';
  payload: { problemTitle: string; queueLength: number };
}

export interface QueueUpdatedMessage {
  action: 'QUEUE_UPDATED';
  payload: { queueLength: number };
}

// Union types for type-safe routing
export type IncomingMessage =
  | SubmissionDetectedMessage
  | TriggerSyncMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | DeleteQueueItemMessage
  | ClearQueueMessage;

export type OutgoingMessage =
  | SyncSuccessMessage
  | SyncFailedMessage
  | SubmissionQueuedMessage
  | QueueUpdatedMessage;
```

### Pattern 2: Type-Safe Message Router (Background)

```typescript
// src/background/message-router.ts

import type { IncomingMessage } from '../types/messages';

type MessageHandler<T extends IncomingMessage> = (
  payload: T extends { payload: infer P } ? P : undefined,
  sender: chrome.runtime.MessageSender
) => Promise<unknown>;

const handlers = new Map<string, MessageHandler<any>>();

export function registerHandler<T extends IncomingMessage>(
  action: T['action'],
  handler: MessageHandler<T>
): void {
  handlers.set(action, handler);
}

export function initMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, payload } = message as IncomingMessage;
    
    const handler = handlers.get(action);
    if (!handler) {
      console.warn('[CodeSync] Unknown message action:', action);
      sendResponse({ success: false, error: `Unknown action: ${action}` });
      return false;
    }
    
    handler(payload, sender)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => {
        console.error(`[CodeSync] Handler for ${action} failed:`, error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep channel open for async response
  });
}

// Usage in background/index.ts:
// registerHandler<SubmissionDetectedMessage>('SUBMISSION_DETECTED', handleSubmission);
// registerHandler<TriggerSyncMessage>('TRIGGER_SYNC', handleManualSync);
// initMessageRouter();
```

### Pattern 3: Safe Message Sending (Client Side)

```typescript
// src/utils/messaging.ts

/**
 * Send a message to the background worker with error handling.
 * Safely handles cases where the background worker is not running
 * or no listener is registered.
 */
export async function sendToBackground<T = unknown>(
  action: string,
  payload?: unknown
): Promise<T | null> {
  try {
    const response = await chrome.runtime.sendMessage({ action, payload });
    
    if (response?.success === false) {
      console.warn(`[CodeSync] ${action} failed:`, response.error);
      return null;
    }
    
    return response?.data ?? response;
  } catch (error) {
    const msg = (error as Error).message || '';
    
    // Suppress known benign errors
    if (msg.includes('Receiving end does not exist') ||
        msg.includes('Extension context invalidated') ||
        msg.includes('message port closed')) {
      return null;
    }
    
    console.error(`[CodeSync] sendMessage(${action}) error:`, error);
    return null;
  }
}

/**
 * Broadcast a message to the popup/options page.
 * Silently fails if no UI page is open.
 */
export async function broadcastToUI(message: OutgoingMessage): Promise<void> {
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // Popup/options not open — this is normal
  }
}

/**
 * Send a message to a specific tab's content script.
 */
export async function sendToTab<T = unknown>(
  tabId: number,
  action: string,
  payload?: unknown
): Promise<T | null> {
  try {
    return await chrome.tabs.sendMessage(tabId, { action, payload });
  } catch (error) {
    console.warn(`[CodeSync] sendToTab(${tabId}, ${action}) failed:`, error);
    return null;
  }
}
```

### Pattern 4: Message Listener in React Components

```typescript
// src/popup/hooks/useMessageListener.ts

import { useEffect } from 'react';
import type { OutgoingMessage } from '../../types/messages';

type MessageCallback = (message: OutgoingMessage) => void;

/**
 * React hook to listen for messages from the background worker.
 * Automatically cleans up listener on unmount.
 */
export function useMessageListener(callback: MessageCallback): void {
  useEffect(() => {
    const handler = (
      message: OutgoingMessage,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: unknown) => void
    ) => {
      callback(message);
    };
    
    chrome.runtime.onMessage.addListener(handler);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, [callback]);
}

// Usage in Popup.tsx:
// useMessageListener(useCallback((message) => {
//   if (message.action === 'SYNC_SUCCESS') {
//     showToast('success', `Synced "${message.payload.problemTitle}"`);
//     refreshQueue();
//   }
//   if (message.action === 'SUBMISSION_QUEUED') {
//     refreshQueue();
//   }
// }, []));
```

### Pattern 5: Long-Lived Port Connections

```typescript
// For streaming progress updates during sync

// Background side
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sync-progress') return;
  
  port.onMessage.addListener(async (message) => {
    if (message.action === 'START_SYNC') {
      const queue = await getQueue();
      
      for (let i = 0; i < queue.length; i++) {
        port.postMessage({
          type: 'PROGRESS',
          current: i + 1,
          total: queue.length,
          title: queue[i].title,
        });
        
        await processItem(queue[i]);
      }
      
      port.postMessage({ type: 'COMPLETE' });
    }
  });
  
  port.onDisconnect.addListener(() => {
    console.log('[CodeSync] Sync progress port disconnected');
  });
});

// Popup side
function startSyncWithProgress(): void {
  const port = chrome.runtime.connect({ name: 'sync-progress' });
  
  port.onMessage.addListener((message) => {
    switch (message.type) {
      case 'PROGRESS':
        updateProgressBar(message.current, message.total);
        setStatus(`Syncing "${message.title}"...`);
        break;
      case 'COMPLETE':
        setStatus('All submissions synced!');
        port.disconnect();
        break;
    }
  });
  
  port.postMessage({ action: 'START_SYNC' });
}
```

---

## Templates

### Template: Message Action Constants

```typescript
// src/constants/actions.ts

export const ACTIONS = {
  // Content → Background
  SUBMISSION_DETECTED: 'SUBMISSION_DETECTED',
  
  // Popup/Options → Background
  TRIGGER_SYNC: 'TRIGGER_SYNC',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  DELETE_QUEUE_ITEM: 'DELETE_QUEUE_ITEM',
  CLEAR_QUEUE: 'CLEAR_QUEUE',
  
  // Background → Popup/Options
  SYNC_SUCCESS: 'SYNC_SUCCESS',
  SYNC_FAILED: 'SYNC_FAILED',
  SUBMISSION_QUEUED: 'SUBMISSION_QUEUED',
  QUEUE_UPDATED: 'QUEUE_UPDATED',
} as const;

export type ActionType = typeof ACTIONS[keyof typeof ACTIONS];
```

---

## Checklists

### Message Passing Checklist

- [ ] All message actions are typed and documented
- [ ] `return true` in `onMessage` for all async handlers
- [ ] `sendResponse()` called in ALL code paths (success + error)
- [ ] `sendMessage()` has `.catch()` for closed receivers
- [ ] `postMessage()` includes `source` field for filtering
- [ ] Port connections handle `onDisconnect` cleanup
- [ ] React listeners cleaned up in `useEffect` return
- [ ] No circular message loops (A→B→A→B...)
- [ ] Message payloads are serializable (no functions, DOM nodes)
- [ ] Error messages include the action name for debugging

---

## Anti-Patterns

### ✗ Forgetting to Return true for Async Handlers

```typescript
// BAD — sendResponse called after channel closed
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  fetchData().then(data => sendResponse(data));
  // Missing return true!
});

// GOOD
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  fetchData().then(data => sendResponse(data));
  return true; // ✓ Keeps channel open
});
```

### ✗ Not Handling Closed Popup

```typescript
// BAD — throws when popup is closed
await chrome.runtime.sendMessage({ action: 'SYNC_SUCCESS' });

// GOOD — catch the benign error
await chrome.runtime.sendMessage({ action: 'SYNC_SUCCESS' }).catch(() => {
  // Popup/options not open — expected
});
```

### ✗ Sending Non-Serializable Data

```typescript
// BAD — functions and DOM nodes can't be serialized
chrome.runtime.sendMessage({
  action: 'DATA',
  payload: {
    callback: () => {},           // ✗ Function
    element: document.body,       // ✗ DOM node
    regex: /pattern/,             // ✗ RegExp (becomes {})
  }
});

// GOOD — only plain data
chrome.runtime.sendMessage({
  action: 'DATA',
  payload: {
    text: 'Hello',
    count: 42,
    items: ['a', 'b'],
  }
});
```

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Receiving end does not exist" | No listener in target context | Ensure listener registered; `.catch()` for optional targets |
| sendResponse never fires | Forgot `return true` | Add `return true` to `onMessage` listener |
| Message received but response is `undefined` | `sendResponse()` never called | Call `sendResponse()` in all code branches |
| Duplicate messages | Multiple listeners registered | Clean up with `removeListener` or dedup by action |
| Port disconnected unexpectedly | Service worker terminated | Re-connect on disconnect event |
| Messages are out of order | Async processing with no sequencing | Use queue pattern or sequential promise chain |

---

## References

- [Message Passing Guide](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [chrome.runtime.sendMessage](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage)
- [chrome.tabs.sendMessage](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-sendMessage)
- [chrome.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect)
- [Long-lived Connections](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#connect)

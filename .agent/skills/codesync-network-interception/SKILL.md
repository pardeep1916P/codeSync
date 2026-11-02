---
name: codesync-network-interception
description: Architecture, monkey-patching, GraphQL detection, and bridge communication for CodeSync's native Manifest V3 network interceptors.
---

# CodeSync Network Interception & Content Script Architecture

Use this skill when modifying, maintaining, or debugging the real-time submission detection pipeline in `src/content/interceptor.ts` and `src/content/index.ts`.

---

## 1. Architectural Overview & Context Worlds

In Chrome Manifest V3, content scripts run in an isolated execution environment. To intercept network calls made by single-page application frameworks (such as Next.js on LeetCode), CodeSync uses a two-stage bridge:

```
┌─────────────────────────────────────────────────────────────┐
│ Web Page Context (MAIN World)                               │
│ src/content/interceptor.ts                                  │
│ - Monkey-patches window.fetch and window.XMLHttpRequest     │
│ - Inspects responses without consuming stream (cloned)      │
│ - Detects judging success: statusCode === 10                │
└──────────────────────────────┬──────────────────────────────┘
                               │ window.postMessage
                               │ (CODESYNC_JUDGING_ACCEPTED)
┌──────────────────────────────▼──────────────────────────────┐
│ Extension Content Script (ISOLATED World)                   │
│ src/content/index.ts                                        │
│ - Listens to window messages                                │
│ - Resolves question metadata via LRUCache                   │
│ - Fetches full submissionDetails if needed                  │
│ - Normalizes Problem and Submission objects                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ chrome.runtime.sendMessage
                               │ (action: 'ENQUEUE_SUBMISSION')
┌──────────────────────────────▼──────────────────────────────┐
│ Background Service Worker                                   │
│ src/background/index.ts -> src/queue/index.ts               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Manifest V3 Registration

The interceptor is declared in `public/manifest.json` under `content_scripts` with `"world": "MAIN"` and `"run_at": "document_start"`:

```json
{
  "content_scripts": [
    {
      "matches": [
        "*://*.leetcode.com/*",
        "*://leetcode.com/*",
        "*://*.leetcode.cn/*",
        "*://leetcode.cn/*"
      ],
      "js": ["interceptor.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": [
        "*://*.leetcode.com/*",
        "*://leetcode.com/*",
        "*://*.leetcode.cn/*",
        "*://leetcode.cn/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

---

## 3. Monkey-Patching Invariants

### 1. Non-Destructive Response Cloning
You must **never** consume the original response body stream, as the host application needs it to render the UI:

```typescript
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch(...args);

  try {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
    
    if (url.includes('/graphql') || url.includes('/check/') || url.includes('/submit')) {
      // CLONE before reading JSON
      const cloned = response.clone();
      cloned.json().then((json) => {
        handleInterceptedPayload(url, json);
      }).catch(() => {});
    }
  } catch (err) {
    // Interceptor must never crash host page operations
  }

  return response;
};
```

### 2. LeetCode Judging Status Codes
LeetCode assigns integer status codes to submissions:
- **`10`**: **Accepted (AC)** $\rightarrow$ **Trigger synchronization**
- `11`: Wrong Answer (WA) $\rightarrow$ Ignore
- `12`: Memory Limit Exceeded $\rightarrow$ Ignore
- `13`: Output Limit Exceeded $\rightarrow$ Ignore
- `14`: Time Limit Exceeded (TLE) $\rightarrow$ Ignore
- `15`: Runtime Error $\rightarrow$ Ignore
- `16`: Compile Error $\rightarrow$ Ignore
- `20`: Pending / Judging $\rightarrow$ Wait for subsequent check polling

---

## 4. Zero-Latency Metadata Pre-Caching

To enqueue submissions in under 10 milliseconds without making blocking network requests after judge completion, `interceptor.ts` intercepts GraphQL queries containing question details and caches them immediately:

```typescript
// Detect question metadata during normal problem page load
if (json?.data?.question) {
  const q = json.data.question;
  window.postMessage({
    type: 'CODESYNC_QUESTION_METADATA',
    payload: {
      questionId: q.questionId,
      title: q.title,
      titleSlug: q.titleSlug,
      difficulty: q.difficulty,
      content: q.content,
      topicTags: q.topicTags,
    }
  }, '*');
}
```

In `src/content/index.ts`, incoming metadata is stored in an in-memory `LRUCache`:
```typescript
const questionCache = new LRUCache<string, QuestionMetadata>(50);
const processedSubmissionIds = new LRUCache<string, boolean>(200);
```

---

## 5. Message Contracts

### MAIN $\rightarrow$ ISOLATED Bridge:
- `CODESYNC_LOG`: Diagnostic logging relayed to extension logger.
- `CODESYNC_QUESTION_METADATA`: Pre-cached problem definition and HTML description.
- `CODESYNC_JUDGING_ACCEPTED`: Emitted when judging returns `statusCode: 10`. Contains `submissionId`.

### ISOLATED $\rightarrow$ Background Bridge:
```typescript
chrome.runtime.sendMessage({
  action: 'ENQUEUE_SUBMISSION',
  payload: submissionObject,
}, (response) => {
  if (response?.success) {
    logToBackground('Successfully enqueued submission:', submissionObject.id);
  }
});
```

---

## 6. Troubleshooting Guide

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Submissions not captured** | Page uses dynamic URL patterns or GraphQL query names changed | Check service worker logs (`action: 'LOG'`) and verify if URL matches `/graphql`, `/check/`, or `/submit/`. |
| **Response body already read error** | Interceptor called `.json()` or `.text()` on original response | Ensure `response.clone()` is called before reading the stream. |
| **Extension context invalidated** | Extension reloaded during development while tab remained open | Wrap calls with `isContextInvalidated()` check in `src/content/index.ts` to prevent runtime exception spam. |
| **Duplicate submissions enqueued** | Both fetch and XHR captured the same poll event | Enforce bounded deduplication using `processedSubmissionIds.has(submissionId)` in `src/content/index.ts`. |

---
name: network-interception
description: Network request interception strategies in MV3 — fetch/XHR monkeypatching, response inspection, and GraphQL payload detection for CodeSync.
---

# Network Interception — Fetch/XHR Monkeypatching in MV3

## Purpose & Scope

Use this skill when:
- Intercepting network requests on web pages from an extension
- Reading response bodies from fetch/XHR calls
- Detecting specific GraphQL mutations or query results
- Choosing between declarativeNetRequest vs monkeypatching
- Implementing robust interceptors that never break the host page

---

## Decision Tree

```
Need to intercept network requests in MV3?
├─ What do you need?
│  ├─ Block/redirect requests → declarativeNetRequest
│  ├─ Modify request headers → declarativeNetRequest
│  ├─ Read response bodies → Monkeypatch fetch/XHR (MAIN world)
│  └─ Read response headers → Monkeypatch or webRequest (non-blocking)
├─ Monkeypatching approach:
│  ├─ Must run in MAIN world (page's JS context)
│  ├─ Wrap original fetch/XHR, never replace
│  ├─ Clone responses before reading (.clone())
│  ├─ Wrap ALL code in try-catch (never break the page)
│  └─ Communicate results via window.postMessage
└─ Which is right for CodeSync?
   └─ Monkeypatching — we need to READ GraphQL response bodies
      to detect statusCode: 10 (Accepted), which declarativeNetRequest cannot do
```

---

## Architecture & Concepts

### Why Monkeypatching for CodeSync

LeetCode uses GraphQL for submission results. We need to:
1. Detect when a submission is judged as "Accepted" (statusCode: 10)
2. Read the response body to extract the submission ID
3. This requires **reading response bodies** — impossible with declarativeNetRequest

### Interception Pipeline

```
LeetCode Page
│
│  fetch('leetcode.com/graphql', { body: submissionQuery })
│
▼
Monkeypatched fetch() [MAIN world]
│  1. Call original fetch()
│  2. Clone the response
│  3. Read cloned body as JSON
│  4. Check for statusCode === 10
│  5. If accepted → postMessage to ISOLATED world
│  6. Return ORIGINAL response to LeetCode (untouched)
│
▼
Content Script [ISOLATED world]
│  Receives postMessage
│  Fetches full submission details via separate GraphQL call
│  Sends to background via chrome.runtime.sendMessage
│
▼
Background Service Worker
│  Enqueues submission in commit queue
```

---

## Implementation Patterns

### Pattern 1: Complete Fetch Interceptor

```typescript
function createFetchInterceptor(): string {
  return `
    (function() {
      'use strict';
      const LOG = '[CodeSync:Net]';
      const originalFetch = window.fetch;
      
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        
        try {
          // Only intercept GraphQL endpoints
          const url = getUrlFromArgs(args);
          if (!url.includes('/graphql')) return response;
          
          // Clone to preserve original for the page
          const clone = response.clone();
          const text = await clone.text();
          
          // Try to parse as JSON
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            return response; // Not JSON, skip
          }
          
          // Inspect for accepted submissions
          checkForAcceptedSubmission(json);
          
        } catch (error) {
          // NEVER let interceptor errors break the page
          console.debug(LOG, 'Intercept error (safe):', error?.message);
        }
        
        return response; // Always return original
      };
      
      function getUrlFromArgs(args) {
        if (typeof args[0] === 'string') return args[0];
        if (args[0] instanceof Request) return args[0].url;
        if (args[0]?.url) return args[0].url;
        return '';
      }
      
      function checkForAcceptedSubmission(json) {
        // Pattern 1: submissionDetails query result
        const details = json?.data?.submissionDetails;
        if (details?.statusCode === 10) {
          notify('CODESYNC_SUBMISSION_ACCEPTED', {
            submissionId: String(details.id || details.submissionId || ''),
          });
          return;
        }
        
        // Pattern 2: submit mutation result
        const submit = json?.data?.submit;
        if (submit?.statusCode === 10) {
          notify('CODESYNC_JUDGING_ACCEPTED', {
            submissionId: String(submit.submissionId || submit.id || ''),
          });
          return;
        }
        
        // Pattern 3: submissionProgress/check
        const progress = json?.data?.submissionProgress || json?.data?.checkSubmission;
        if (progress?.statusCode === 10) {
          notify('CODESYNC_JUDGING_ACCEPTED', {
            submissionId: String(progress.submissionId || progress.id || ''),
          });
        }
      }
      
      function notify(type, detail) {
        window.postMessage({
          type,
          detail,
          source: 'codesync-interceptor',
          timestamp: Date.now(),
        }, '*');
      }
      
      console.log(LOG, 'Fetch interceptor active');
    })();
  `;
}
```

### Pattern 2: XHR Interceptor

```typescript
function createXHRInterceptor(): string {
  return `
    (function() {
      'use strict';
      const LOG = '[CodeSync:XHR]';
      
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__codeSyncUrl = typeof url === 'string' ? url : url?.toString() || '';
        this.__codeSyncMethod = method;
        return originalOpen.apply(this, [method, url, ...rest]);
      };
      
      XMLHttpRequest.prototype.send = function(body) {
        const url = this.__codeSyncUrl || '';
        
        if (url.includes('/graphql') && this.__codeSyncMethod === 'POST') {
          this.addEventListener('load', function onLoad() {
            try {
              if (this.status >= 200 && this.status < 300) {
                const json = JSON.parse(this.responseText);
                checkForAcceptedSubmission(json);
              }
            } catch (e) {
              // Silent — never break page
            }
          }, { once: true });
        }
        
        return originalSend.apply(this, [body]);
      };
      
      console.log(LOG, 'XHR interceptor active');
    })();
  `;
}
```

### Pattern 3: Deduplication Guard

```typescript
// Prevent duplicate detections from both fetch and XHR interceptors

function createDeduplicationGuard(): string {
  return `
    (function() {
      const seen = new Set();
      const DEDUP_WINDOW = 5000; // 5 second window
      
      const originalPostMessage = window.postMessage;
      
      window.postMessage = function(message, ...args) {
        if (message?.source === 'codesync-interceptor' && message?.detail?.submissionId) {
          const key = message.type + ':' + message.detail.submissionId;
          
          if (seen.has(key)) {
            return; // Duplicate within window
          }
          
          seen.add(key);
          setTimeout(() => seen.delete(key), DEDUP_WINDOW);
        }
        
        return originalPostMessage.apply(this, [message, ...args]);
      };
    })();
  `;
}
```

---

## Checklists

### Network Interception Checklist

- [ ] Response cloned before reading body (`.clone()`)
- [ ] All interceptor code in try-catch (never break the page)
- [ ] Original fetch/XHR fully preserved
- [ ] Only GraphQL URLs intercepted (not all requests)
- [ ] Deduplication prevents repeated events
- [ ] `postMessage` includes `source` field for filtering
- [ ] Handles all LeetCode GraphQL response shapes
- [ ] Tested with LeetCode's actual submission flow
- [ ] Works with both fetch and XHR (LeetCode uses both)

---

## Anti-Patterns

### ✗ Consuming the Response Body

```javascript
// BAD — page gets empty body
const response = await originalFetch.apply(this, args);
const json = await response.json(); // Body consumed!
return response; // Page sees empty body

// GOOD — clone first
const response = await originalFetch.apply(this, args);
const clone = response.clone();
const json = await clone.json(); // Read clone
return response; // Page gets full original
```

### ✗ Throwing Errors in Interceptor

```javascript
// BAD — breaks LeetCode
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  const json = await response.clone().json(); // Throws on non-JSON!
  return response;
};

// GOOD — wrap in try-catch
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  try {
    if (shouldIntercept(args)) {
      const json = await response.clone().json();
      inspect(json);
    }
  } catch { /* silent */ }
  return response;
};
```

---

## References

- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
- [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [Content Script Worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#isolated_world)

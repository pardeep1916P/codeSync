---
name: content-scripts
description: Content script development, world isolation, DOM interaction, and network interception patterns for the CodeSync Chrome extension.
---

# Content Scripts — Injection, Isolation & Network Interception

## Purpose & Scope

Use this skill when:
- Creating or modifying content scripts that run on LeetCode pages
- Implementing network request interception (fetch/XHR monkeypatching)
- Setting up communication between page context and extension context
- Injecting scripts into the MAIN world for DOM/API access
- Handling dynamic page navigation in SPAs (Single Page Applications)

Do NOT use when:
- Working on the background service worker (see `background-service-worker`)
- Building the popup or options UI (see `popup-ui`)
- Processing the intercepted data (see `leetcode/submission-detector`)

---

## Decision Tree

```
Need to interact with a web page?
├─ Need access to page's JavaScript context (window, fetch, XHR)?
│  ├─ Yes → Inject into MAIN world
│  │  ├─ Static? → manifest content_scripts with world: "MAIN"
│  │  └─ Dynamic? → Inject <script> element from ISOLATED world
│  └─ No → Use ISOLATED world (default)
├─ Need to read/modify DOM?
│  ├─ ISOLATED world can access DOM ✓
│  └─ MAIN world can access DOM ✓
├─ Need chrome.* APIs?
│  ├─ ISOLATED world has full access ✓
│  └─ MAIN world has NO access ✗ → Use window.postMessage bridge
├─ Need to intercept network requests?
│  ├─ Monkeypatch fetch/XHR? → MAIN world required
│  └─ Observe only? → Can use PerformanceObserver in either world
└─ Page is an SPA with client-side routing?
   ├─ Use MutationObserver on URL changes
   └─ Listen for popstate/hashchange events
```

---

## Architecture & Concepts

### World Isolation Model

Chrome extensions run content scripts in two possible worlds:

```
┌─────────────────────────────────────┐
│           Web Page (leetcode.com)    │
│                                     │
│  ┌──────────────┐  ┌─────────────┐  │
│  │  MAIN World  │  │  ISOLATED   │  │
│  │              │  │   World     │  │
│  │ • window.*   │  │             │  │
│  │ • fetch()    │  │ • chrome.*  │  │
│  │ • XHR        │  │ • DOM       │  │
│  │ • DOM        │  │ • No page   │  │
│  │ • Page JS    │  │   JS access │  │
│  │              │  │             │  │
│  │ No chrome.*  │  │             │  │
│  └──────┬───────┘  └──────┬──────┘  │
│         │  postMessage()  │         │
│         └────────┬────────┘         │
│                  │                  │
└──────────────────┼──────────────────┘
                   │ chrome.runtime.sendMessage()
         ┌─────────┴──────────┐
         │  Background Worker  │
         │  (Service Worker)   │
         └────────────────────┘
```

### CodeSync Content Script Architecture

```
Content Script Flow:
1. ISOLATED world script loads (dist/content.js)
2. Injects MAIN world script via <script> element
3. MAIN world script monkeypatches fetch() and XMLHttpRequest
4. LeetCode makes GraphQL request → intercepted
5. MAIN world detects "Accepted" status → window.postMessage()
6. ISOLATED world receives postMessage → fetches submission details
7. ISOLATED world sends full submission to background via chrome.runtime.sendMessage()
```

---

## Implementation Patterns

### Pattern 1: CodeSync Content Script (ISOLATED World)

```typescript
// src/content/index.ts — Runs in ISOLATED world

const LOG_PREFIX = '[CodeSync:Content]';

// ============================================================
// Step 1: Inject the MAIN world interceptor script
// ============================================================
function injectPageScript(): void {
  const script = document.createElement('script');
  script.textContent = getInterceptorCode();
  script.setAttribute('data-codesync', 'interceptor');
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // Clean up — code already executed
  console.log(LOG_PREFIX, 'Page interceptor injected');
}

// ============================================================
// Step 2: Listen for intercepted submissions from MAIN world
// ============================================================
window.addEventListener('message', async (event) => {
  // Only accept messages from the same page
  if (event.source !== window) return;
  
  const { type, detail } = event.data || {};
  
  if (type === 'CODESYNC_SUBMISSION_ACCEPTED') {
    console.log(LOG_PREFIX, 'Accepted submission detected:', detail.submissionId);
    await handleAcceptedSubmission(detail.submissionId);
  }
  
  if (type === 'CODESYNC_JUDGING_ACCEPTED') {
    console.log(LOG_PREFIX, 'Judging result accepted:', detail.submissionId);
    await handleAcceptedSubmission(detail.submissionId);
  }
});

// ============================================================
// Step 3: Fetch full submission details via GraphQL
// ============================================================
async function handleAcceptedSubmission(submissionId: string): Promise<void> {
  try {
    const details = await fetchSubmissionDetails(submissionId);
    if (!details) {
      console.warn(LOG_PREFIX, 'Could not fetch details for', submissionId);
      return;
    }
    
    // Send to background service worker
    await chrome.runtime.sendMessage({
      action: 'SUBMISSION_DETECTED',
      payload: {
        id: submissionId,
        problem: {
          title: details.question.title,
          titleSlug: details.question.titleSlug,
          difficulty: details.question.difficulty,
        },
        language: details.lang.name,
        code: details.code,
        timestamp: details.timestamp * 1000,
      }
    });
    
    console.log(LOG_PREFIX, `Submission "${details.question.title}" sent to background`);
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to process submission:', error);
  }
}

async function fetchSubmissionDetails(id: string): Promise<SubmissionDetails | null> {
  const query = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtime
        memory
        code
        statusCode
        lang { name verboseName }
        question { title titleSlug difficulty questionId }
        timestamp
      }
    }
  `;
  
  const response = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': window.location.href,
    },
    body: JSON.stringify({
      query,
      variables: { submissionId: parseInt(id, 10) },
    }),
  });
  
  const json = await response.json();
  return json?.data?.submissionDetails || null;
}

// Initialize
injectPageScript();
```

### Pattern 2: MAIN World Network Interceptor

```typescript
// This code runs in the MAIN world — it has access to window.fetch
// but NO access to chrome.* APIs

function getInterceptorCode(): string {
  return `
    (function() {
      'use strict';
      
      const LOG = '[CodeSync:Interceptor]';
      
      // ========================================
      // Monkeypatch fetch()
      // ========================================
      const originalFetch = window.fetch;
      
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        
        try {
          const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
          
          if (url.includes('/graphql')) {
            // Clone response to read body without consuming it
            const clone = response.clone();
            const json = await clone.json();
            
            inspectGraphQLResponse(json);
          }
        } catch (e) {
          // Silently ignore — never break the page
        }
        
        return response;
      };
      
      // ========================================
      // Monkeypatch XMLHttpRequest
      // ========================================
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._codeSyncUrl = url;
        return originalOpen.apply(this, [method, url, ...rest]);
      };
      
      XMLHttpRequest.prototype.send = function(body) {
        if (this._codeSyncUrl && this._codeSyncUrl.includes('/graphql')) {
          this.addEventListener('load', function() {
            try {
              const json = JSON.parse(this.responseText);
              inspectGraphQLResponse(json);
            } catch (e) {
              // Silently ignore
            }
          });
        }
        return originalSend.apply(this, [body]);
      };
      
      // ========================================
      // Inspect GraphQL Response
      // ========================================
      function inspectGraphQLResponse(json) {
        // Check for submission result with statusCode 10 (Accepted)
        if (json?.data?.submissionDetails?.statusCode === 10) {
          const detail = json.data.submissionDetails;
          window.postMessage({
            type: 'CODESYNC_SUBMISSION_ACCEPTED',
            detail: {
              submissionId: String(detail.id || ''),
              statusCode: detail.statusCode,
            }
          }, '*');
          return;
        }
        
        // Check for judging result
        if (json?.data?.submissionProgress?.statusCode === 10 ||
            json?.data?.submit?.statusCode === 10) {
          const data = json.data.submissionProgress || json.data.submit;
          window.postMessage({
            type: 'CODESYNC_JUDGING_ACCEPTED',
            detail: {
              submissionId: String(data.submissionId || data.id || ''),
              statusCode: data.statusCode,
            }
          }, '*');
        }
      }
      
      console.log(LOG, 'Network interceptor active');
    })();
  `;
}
```

### Pattern 3: SPA Navigation Detection

LeetCode is a React SPA — page changes don't trigger new content script injections:

```typescript
// Detect client-side navigation in LeetCode's SPA
function watchNavigation(callback: (url: string) => void): void {
  let lastUrl = location.href;
  
  // Method 1: MutationObserver on <title> changes
  const titleObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback(lastUrl);
    }
  });
  
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, { childList: true });
  }
  
  // Method 2: popstate for back/forward navigation
  window.addEventListener('popstate', () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback(lastUrl);
    }
  });
  
  // Method 3: Intercept pushState/replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback(lastUrl);
    }
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback(lastUrl);
    }
  };
}

// Usage
watchNavigation((url) => {
  console.log(LOG_PREFIX, 'Navigation detected:', url);
  if (url.includes('/problems/') && url.includes('/submissions/')) {
    // User navigated to a submission page
  }
});
```

### Pattern 4: Robust Message Bridge

```typescript
// A more robust bridge that handles retries and timeouts

class ContentBridge {
  private pendingMessages = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  
  constructor() {
    window.addEventListener('message', this.handleResponse.bind(this));
  }
  
  async sendToBackground(action: string, payload?: unknown): Promise<unknown> {
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage({ action, payload });
        
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        
        return response;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        
        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 500)
        );
      }
    }
  }
  
  sendToPage(type: string, detail: unknown): void {
    window.postMessage({ type, detail, source: 'codesync-content' }, '*');
  }
  
  private handleResponse(event: MessageEvent): void {
    if (event.source !== window) return;
    if (event.data?.source !== 'codesync-page') return;
    
    const { messageId, response } = event.data;
    const pending = this.pendingMessages.get(messageId);
    
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(response);
      this.pendingMessages.delete(messageId);
    }
  }
}
```

---

## Templates

### Template: New Platform Content Script

```typescript
// Template for adding a new platform (e.g., GeeksforGeeks)
// src/content/gfg.ts

const LOG_PREFIX = '[CodeSync:GFG]';

interface GfgSubmission {
  problemTitle: string;
  problemSlug: string;
  language: string;
  code: string;
  difficulty: string;
}

// Step 1: Detect successful submission
function observeSubmissionResult(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Look for GFG's success indicator
          const successEl = node.querySelector('.score_card_v2_v2');
          if (successEl && successEl.textContent?.includes('Correct')) {
            handleGfgSuccess();
          }
        }
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

// Step 2: Extract submission data
async function handleGfgSuccess(): Promise<void> {
  const submission = extractSubmissionData();
  if (!submission) return;
  
  await chrome.runtime.sendMessage({
    action: 'SUBMISSION_DETECTED',
    payload: {
      id: `gfg_${Date.now()}`,
      problem: {
        title: submission.problemTitle,
        titleSlug: submission.problemSlug,
        difficulty: submission.difficulty,
      },
      language: submission.language,
      code: submission.code,
      timestamp: Date.now(),
      platform: 'geeksforgeeks',
    }
  });
}

function extractSubmissionData(): GfgSubmission | null {
  // Platform-specific extraction logic
  const codeEditor = document.querySelector('.ace_content');
  const titleEl = document.querySelector('.problem-tab__title');
  
  if (!codeEditor || !titleEl) return null;
  
  return {
    problemTitle: titleEl.textContent?.trim() || 'Unknown',
    problemSlug: window.location.pathname.split('/').filter(Boolean).pop() || '',
    language: detectLanguage(),
    code: codeEditor.textContent || '',
    difficulty: detectDifficulty(),
  };
}

// Initialize
observeSubmissionResult();
```

---

## Checklists

### Content Script Development Checklist

- [ ] Script injected at the correct `run_at` timing (`document_idle` for CodeSync)
- [ ] MAIN world script never references `chrome.*` APIs
- [ ] ISOLATED world properly bridges messages via `window.postMessage`
- [ ] `postMessage` includes a `source` field to filter own messages
- [ ] `event.source === window` check prevents cross-frame messages
- [ ] Network interceptor never throws — all code wrapped in try/catch
- [ ] Original `fetch`/`XHR` functionality preserved (no data loss)
- [ ] Response cloned before reading body (`response.clone()`)
- [ ] SPA navigation changes detected and handled
- [ ] No memory leaks from MutationObservers (disconnect when done)
- [ ] Script element removed from DOM after injection
- [ ] Errors logged with `[CodeSync]` prefix for easy filtering

### Security Checklist for Content Scripts

- [ ] Never inject user-controlled strings into page scripts
- [ ] Never use `eval()` or `innerHTML` with untrusted data
- [ ] Validate all data received via `postMessage`
- [ ] Check `event.origin` if communicating cross-origin
- [ ] Don't expose extension internal URLs to the page
- [ ] Sanitize data before sending to background worker

---

## Anti-Patterns

### ✗ Using eval() or innerHTML for Script Injection

```typescript
// BAD — security risk, CSP violation
document.head.innerHTML += '<script>interceptFetch()</script>';

// BAD — eval in content script
eval(interceptorCode);

// GOOD — createElement with textContent
const script = document.createElement('script');
script.textContent = interceptorCode;
document.head.appendChild(script);
script.remove();
```

### ✗ Not Cloning Responses Before Reading

```typescript
// BAD — consumes the response body, breaks the page
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  const json = await response.json(); // ✗ Body consumed!
  inspect(json);
  return response; // Page gets empty body
};

// GOOD — clone before reading
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  const clone = response.clone(); // ✓ Original preserved
  clone.json().then(inspect).catch(() => {});
  return response;
};
```

### ✗ Breaking on Errors in Interceptor

```typescript
// BAD — interceptor error breaks LeetCode
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  const json = await response.clone().json(); // ✗ Crashes on non-JSON
  return response;
};

// GOOD — wrap everything in try/catch
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  try {
    const url = typeof args[0] === 'string' ? args[0] : '';
    if (url.includes('/graphql')) {
      const json = await response.clone().json();
      inspectGraphQLResponse(json);
    }
  } catch (e) {
    // Silently ignore — never break the host page
  }
  return response;
};
```

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| Content script doesn't run | `matches` pattern wrong | Check URL against manifest pattern |
| MAIN world script can't access `chrome.*` | By design — MAIN world has no extension APIs | Use `postMessage` bridge to ISOLATED world |
| `postMessage` not received | Missing `event.source === window` check or wrong type field | Verify both sender and receiver use same message format |
| Interceptor breaks LeetCode | Error thrown in fetch wrapper | Wrap all interceptor code in try/catch |
| Duplicate submissions detected | No deduplication on submission ID | Track seen IDs with `Set` in content script |
| Script runs on wrong pages | Overly broad `matches` pattern | Narrow to `https://leetcode.com/problems/*` |
| DOM elements not found | Script runs before DOM ready | Use `run_at: "document_idle"` or MutationObserver |
| Memory leak in SPA | MutationObserver never disconnected | Disconnect observers when navigating away |

---

## References

- [Content Scripts Guide](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Content Script Worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#isolated_world)
- [chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [MutationObserver API](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

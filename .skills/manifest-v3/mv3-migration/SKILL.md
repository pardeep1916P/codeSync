---
name: mv3-migration
description: Guide for migrating Chrome extensions from Manifest V2 to V3, covering service workers, CSP, permissions, and API changes relevant to CodeSync.
---

# MV3 Migration — From Manifest V2 to V3

## Purpose & Scope

Use this skill when:
- Migrating an existing MV2 extension to MV3
- Understanding the differences between MV2 and MV3
- Identifying MV2 patterns that break in MV3
- Planning migration timelines and testing strategies

---

## Decision Tree

```
Migrating from MV2 to MV3?
├─ Background page?
│  ├─ Persistent background → Event-driven service worker
│  ├─ background.scripts[] → background.service_worker (single file)
│  └─ Global state → chrome.storage persistence
├─ Web requests?
│  ├─ webRequest blocking → declarativeNetRequest
│  └─ webRequest observing → Still available (limited)
├─ Remote code?
│  ├─ CDN scripts → Bundle locally
│  ├─ eval() → Remove (CSP forbids)
│  └─ Dynamic Function() → Use alternatives
├─ Content scripts?
│  ├─ No changes for ISOLATED world
│  └─ MAIN world → New "world": "MAIN" option
├─ Permissions?
│  ├─ Host permissions → Separate "host_permissions" field
│  └─ browser_action/page_action → Unified "action"
└─ APIs removed?
   ├─ chrome.extension.getBackgroundPage() → Use messaging
   ├─ chrome.extension.getURL() → chrome.runtime.getURL()
   └─ chrome.browserAction → chrome.action
```

---

## MV2 → MV3 Migration Table

| MV2 Feature | MV3 Replacement | Migration Effort |
|-------------|-----------------|------------------|
| `background.scripts` | `background.service_worker` | Medium |
| `background.persistent: true` | Event-driven (no equivalent) | High |
| Global variables in background | `chrome.storage.session` / `local` | Medium |
| `chrome.browserAction` | `chrome.action` | Low (rename) |
| `chrome.pageAction` | `chrome.action` | Low (rename) |
| Host perms in `permissions` | `host_permissions` field | Low |
| `webRequest` blocking | `declarativeNetRequest` | High |
| `chrome.extension.getBackgroundPage()` | `chrome.runtime.sendMessage()` | Medium |
| `eval()` / `new Function()` | Pre-compiled code | Medium |
| Remote `<script src="...">` | Local bundled code | Low |
| `content_security_policy` string | `content_security_policy.extension_pages` | Low |

---

## Implementation Patterns

### Pattern 1: Background Page → Service Worker

```javascript
// MV2: background.js (persistent page)
let submissionCount = 0;  // ← Persists forever

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SUBMISSION') {
    submissionCount++;
    sendResponse({ count: submissionCount });
  }
});

// MV3: background.js (service worker)
// submissionCount is LOST when worker terminates!
// Must persist to storage:

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SUBMISSION') {
    chrome.storage.session.get('submissionCount').then(({ submissionCount = 0 }) => {
      submissionCount++;
      chrome.storage.session.set({ submissionCount });
      sendResponse({ count: submissionCount });
    });
    return true; // Async response
  }
});
```

### Pattern 2: browserAction → action

```javascript
// MV2
chrome.browserAction.setBadgeText({ text: '5' });
chrome.browserAction.onClicked.addListener(tab => {});

// MV3
chrome.action.setBadgeText({ text: '5' });
chrome.action.onClicked.addListener(tab => {});
```

### Pattern 3: Network Interception Strategy

```
MV2 approach (webRequest blocking):
  chrome.webRequest.onBeforeRequest → modify/block requests

MV3 approach for CodeSync:
  Option A: declarativeNetRequest (static rules, limited)
  Option B: Monkeypatch fetch/XHR in MAIN world ← CodeSync uses this
  
  Why Option B for CodeSync:
  - Need to READ response bodies (declarativeNetRequest can't)
  - Need to inspect GraphQL payload for statusCode: 10
  - declarativeNetRequest only does redirect/block/modify-headers
```

---

## Checklists

### MV3 Migration Checklist

- [ ] `manifest_version` changed to `3`
- [ ] `background.scripts` replaced with `background.service_worker`
- [ ] All global state persisted to `chrome.storage`
- [ ] `setInterval`/`setTimeout` replaced with `chrome.alarms`
- [ ] `chrome.browserAction` renamed to `chrome.action`
- [ ] Host permissions moved to `host_permissions`
- [ ] All remote code bundled locally
- [ ] No `eval()` or `new Function()` in codebase
- [ ] CSP updated to MV3 format
- [ ] `chrome.extension.*` replaced with `chrome.runtime.*`
- [ ] All event listeners at top-level synchronous scope
- [ ] Tested: worker termination and restart behavior

---

## References

- [MV3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate)
- [MV3 Migration Checklist](https://developer.chrome.com/docs/extensions/develop/migrate/checklist)
- [Known Issues](https://developer.chrome.com/docs/extensions/develop/migrate/known-issues)

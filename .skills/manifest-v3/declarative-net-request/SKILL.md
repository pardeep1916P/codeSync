---
name: declarative-net-request
description: Chrome declarativeNetRequest API for static request blocking, redirecting, and header modification in MV3 extensions.
---

# Declarative Net Request — Static Rule-Based Network Control

## Purpose & Scope

Use this skill when:
- Blocking unwanted requests (ads, trackers) from extension pages
- Redirecting URLs (e.g., HTTP → HTTPS)
- Modifying request/response headers without reading bodies
- Understanding when to use declarativeNetRequest vs monkeypatching

Do NOT use when:
- Need to read response bodies (use fetch monkeypatching instead)
- Need to inspect GraphQL payloads (use MAIN world interception)

---

## Decision Tree

```
declarativeNetRequest vs monkeypatching?
├─ Need to block requests? → declarativeNetRequest ✓
├─ Need to redirect? → declarativeNetRequest ✓
├─ Need to modify headers? → declarativeNetRequest ✓
├─ Need to read response body? → Monkeypatch ✓ (DNR cannot)
├─ Need to inspect POST body? → Monkeypatch ✓ (DNR cannot)
└─ Need conditional logic based on response? → Monkeypatch ✓
```

## Architecture & Concepts

### Rule Structure

```json
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "block" | "redirect" | "allow" | "upgradeScheme" |
            "modifyHeaders" | "allowAllRequests"
  },
  "condition": {
    "urlFilter": "||ads.example.com",
    "resourceTypes": ["script", "image"],
    "domains": ["leetcode.com"]
  }
}
```

### Why CodeSync Uses Monkeypatching Instead

| Feature | declarativeNetRequest | Monkeypatching |
|---------|----------------------|----------------|
| Read response body | ✗ | ✓ |
| Inspect GraphQL result | ✗ | ✓ |
| Block requests | ✓ | ✗ |
| Modify headers | ✓ | ✗ |
| Dynamic conditions | Limited | Full JS logic |
| Performance | Better | Slight overhead |

**CodeSync needs to read response bodies** to detect `statusCode: 10` in GraphQL responses. This is fundamentally impossible with declarativeNetRequest, which operates at the network layer before response bodies are available.

---

## Implementation Patterns

### Pattern 1: Static Rule File

```json
// public/rules.json
[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "upgradeScheme" },
    "condition": {
      "urlFilter": "http://api.github.com/*",
      "resourceTypes": ["xmlhttprequest"]
    }
  }
]
```

```json
// manifest.json
{
  "declarative_net_request": {
    "rule_resources": [{
      "id": "security_rules",
      "enabled": true,
      "path": "rules.json"
    }]
  },
  "permissions": ["declarativeNetRequest"]
}
```

### Pattern 2: Dynamic Rules at Runtime

```typescript
// Add a rule dynamically
await chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
    id: 100,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'X-CodeSync-Version',
        operation: 'set',
        value: '1.0.0'
      }]
    },
    condition: {
      urlFilter: 'api.github.com',
      resourceTypes: ['xmlhttprequest']
    }
  }],
  removeRuleIds: [100] // Remove existing rule with same ID first
});
```

---

## Checklists

### declarativeNetRequest Checklist

- [ ] Rules file is valid JSON array
- [ ] Each rule has unique ID
- [ ] `declarativeNetRequest` permission in manifest
- [ ] Rule priorities set correctly (higher = more priority)
- [ ] Resource types specified to avoid over-matching
- [ ] Dynamic rules cleaned up when no longer needed
- [ ] Rule count within limits (static: 30K, dynamic: 5K)

---

## References

- [declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [Rule Format](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-Rule)
- [Migration from webRequest](https://developer.chrome.com/docs/extensions/develop/migrate/blocking-web-requests)

---
name: extension-security
description: Chrome extension security architecture, threat modeling, CSP policies, and secure coding patterns for CodeSync.
---

# Extension Security — Threat Model & Secure Architecture

## Purpose & Scope

Use this skill when auditing security, implementing secure patterns, or reviewing code for security vulnerabilities in the CodeSync extension.

---

## Threat Model

### Attack Surface

| Surface | Threat | Mitigation |
|---------|--------|-----------|
| Content script | XSS via page injection | Never use innerHTML with untrusted data |
| postMessage | Spoofed messages from page | Validate source, check origin |
| GitHub token | Token theft/exposure | Store in chrome.storage.local only, never in code |
| OAuth flow | CSRF, token interception | Use state parameter, validate redirect |
| Network requests | MITM, response tampering | HTTPS only, validate responses |
| Storage | Data leakage | No secrets in sync storage |
| Manifest | Over-permissioning | Principle of least privilege |
| Dependencies | Supply chain attacks | Audit deps, use lockfile |

### Security Boundaries

```
┌─────────────────────────────────────────┐
│  TRUSTED ZONE (Extension Context)        │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ Background   │  │ Popup/Options   │  │
│  │ (full chrome │  │ (full chrome    │  │
│  │  API access) │  │  API access)    │  │
│  └──────────────┘  └─────────────────┘  │
│           ↑ chrome.runtime.sendMessage   │
│  ┌────────┴────────────────────────────┐ │
│  │ Content Script (ISOLATED world)     │ │
│  │ (chrome.* access, no page JS)       │ │
│  └────────┬────────────────────────────┘ │
│           │ window.postMessage           │
└───────────┼──────────────────────────────┘
            │  TRUST BOUNDARY
┌───────────┼──────────────────────────────┐
│  UNTRUSTED│ZONE (Web Page)               │
│  ┌────────┴────────────────────────────┐ │
│  │ Page Script (MAIN world)            │ │
│  │ (no chrome.* access)                │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## Security Rules

### Rule 1: Never Expose Tokens to Page Context

```typescript
// BAD — token accessible to page scripts
window.postMessage({ type: 'CONFIG', token: settings.githubToken }, '*');

// GOOD — only send from ISOLATED world to background
chrome.runtime.sendMessage({ action: 'SYNC', payload: { submissionId } });
// Background already has token access
```

### Rule 2: Validate All postMessage Data

```typescript
window.addEventListener('message', (event) => {
  // Verify message comes from our page, not an iframe
  if (event.source !== window) return;
  
  // Verify our custom source identifier
  if (event.data?.source !== 'codesync-interceptor') return;
  
  // Validate expected structure
  if (!event.data?.type || !event.data?.detail?.submissionId) return;
  
  // Only accept known message types
  const ALLOWED_TYPES = ['CODESYNC_SUBMISSION_ACCEPTED', 'CODESYNC_JUDGING_ACCEPTED'];
  if (!ALLOWED_TYPES.includes(event.data.type)) return;
  
  // Safe to process
  handleSubmission(event.data.detail);
});
```

### Rule 3: CSP Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'"
  }
}
```

### Rule 4: No Dynamic Code Execution

```typescript
// FORBIDDEN in MV3 extensions:
eval(code);                    // ✗
new Function(code);            // ✗
setTimeout(codeString);        // ✗
document.write(htmlString);    // ✗

// ALLOWED:
setTimeout(() => { ... });     // ✓ (function, not string)
document.createElement('div'); // ✓
```

---

## Checklists

### Security Audit Checklist

- [ ] No secrets (tokens, keys) hardcoded in source
- [ ] GitHub token only in chrome.storage.local
- [ ] No eval(), new Function(), or dynamic code execution
- [ ] CSP configured in manifest
- [ ] postMessage validated (source, type, structure)
- [ ] All network requests use HTTPS
- [ ] innerHTML not used with untrusted data
- [ ] Permissions follow principle of least privilege
- [ ] OAuth uses state parameter for CSRF protection
- [ ] Dependencies audited for known vulnerabilities
- [ ] No sensitive data logged to console in production
- [ ] chrome.runtime.lastError checked in all callbacks

---

## References

- [Chrome Extension Security](https://developer.chrome.com/docs/extensions/develop/concepts/security)
- [Content Security Policy](https://developer.chrome.com/docs/extensions/develop/concepts/content-security-policy)
- [OWASP Browser Extension Security](https://owasp.org/www-project-browser-extensions/)

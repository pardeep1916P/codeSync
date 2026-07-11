---
name: csp-policies
description: Content Security Policy guidelines for CodeSync Chrome extension to prevent unauthorized script execution and secure storage pages.
---

# Content Security Policy (CSP) Guidelines

## Purpose & Scope
This skill provides instructions for configuring and maintaining Content Security Policies in the CodeSync Chrome Extension. It covers manifest specifications, handling external resources, avoiding inline scripts, and auditing vulnerabilities.

## Decision Tree
`
Need to configure CSP?
â”œâ”€ Is it for Manifest V3?
â”‚  â”œâ”€ Yes â†’ Specify in manifest.json under 'content_security_policy' object
â”‚  â””â”€ No â†’ (V2 deprecated) Migrate to V3 format
â”œâ”€ Loading external scripts/styles?
â”‚  â”œâ”€ Scripts â†’ Forbid. All scripts must be local and bundled.
â”‚  â””â”€ Styles â†’ Allowed via 'self', avoid 'unsafe-inline' unless styling library requires it.
â””â”€ Debugging CSP error?
   â”œâ”€ Refused to load script â†’ Move inline script to a separate .js/.ts file
   â””â”€ Refused to evaluate code â†’ Remove eval() or new Function() from code
`

## Architecture & Concepts
In Manifest V3, CSP is defined separately for extension pages (popup, options, background) and sandboxed pages.

### Manifest Configuration:
`json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
`

## Implementation Patterns
### Safe Styles and Script Loading
Never inject inline event handlers in React code:
`	sx
// BAD: Inline handler can violate strict CSP if parsed dynamically
<button onclick="alert('click')">Sync</button>

// GOOD: React handler bound programmatically
<button onClick={() => alert('click')}>Sync</button>
`

## Checklists
- [ ] No eval() or 
ew Function() in production builds.
- [ ] No external script hosts in script-src.
- [ ] Inline script blocks removed from popup/options HTML.

## References
- [MDN CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Chrome Extension CSP](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-migration/#content-security-policy)

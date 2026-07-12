---
name: oauth-security
description: OAuth security flows, CSRF state verification, and token exchange architecture for CodeSync authentication.
---

# OAuth Security

## Purpose & Scope
Instructions for maintaining secure OAuth authorization flows, avoiding token leakage, and validating OAuth application state.

## Decision Tree
`
Initiating OAuth flow?
â”œâ”€ Generate unique UUID state parameter? â†’ Store local state key
â”œâ”€ Request access through launchWebAuthFlow?
â”‚  â”œâ”€ Response received â†’ Compare returned state with stored state
â”‚  â”œâ”€ Mismatch â†’ Reject authorization (potential CSRF)
â”‚  â””â”€ Match â†’ Pass code to proxy for token exchange
â””â”€ Storing secret keys?
   â””â”€ DO NOT store client secret inside extension. Exchange token via backend.
`

## Checklists
- [ ] Client secret is not bundled inside extension build.
- [ ] State parameter validated before processing callback.
- [ ] OAuth scopes limited strictly to epo permissions.

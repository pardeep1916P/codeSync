---
name: token-management
description: Securely handling, storing, and validating GitHub Personal Access Tokens and OAuth access tokens in CodeSync.
---

# Token Management

## Purpose & Scope
Guidelines on securely capturing, validating, storing, and clearing GitHub Personal Access Tokens (PATs) and OAuth tokens in CodeSync.

## Decision Tree
`
Receive Token?
â”œâ”€ Validate token format and scope (repo)?
â”‚  â”œâ”€ Valid â†’ Store in chrome.storage.local
â”‚  â””â”€ Invalid â†’ Prompt user with clear input validation error
â”œâ”€ Check token status?
â”‚  â”œâ”€ 401 Unauthorized â†’ Prompt re-authentication and clear token
â”‚  â””â”€ 200 OK â†’ Sync solutions normally
â””â”€ User logs out?
   â””â”€ Clear token from chrome.storage.local immediately
`

## Implementation Patterns
### Secure Token Storage & Clearing
`	ypescript
import { storage } from '../storage';

export async function saveToken(token: string): Promise<boolean> {
  if (!token.startsWith('gho_') && !token.startsWith('ghp_')) {
    return false; // Invalid prefix
  }
  await storage.updateSettings({ githubToken: token });
  return true;
}

export async function clearToken(): Promise<void> {
  await storage.updateSettings({ githubToken: '' });
  await chrome.storage.local.remove('_oauthCache');
}
`

## Checklists
- [ ] Token never logged to console or remote endpoints.
- [ ] Token cleared immediately upon user logout or connection reset.
- [ ] Scopes verified to contain epo.

## References
- [GitHub Token Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

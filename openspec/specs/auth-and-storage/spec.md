# Authentication & Storage Capability Specification

## Overview
CodeSync manages user authentication securely using GitHub OAuth or Personal Access Tokens (PAT) and caches state in local browser storage.

## Requirements

### Requirement: Authentication Methods & Zero-Client-Secret Universal OAuth
- CodeSync MUST support GitHub OAuth authentication via `chrome.identity.launchWebAuthFlow()`.
- CodeSync MUST support manual GitHub Personal Access Token (PAT) authentication with `repo` scope.
- Client secrets MUST NEVER be bundled or compiled into frontend extension assets.
- OAuth token exchanges MUST route through a central universal callback endpoint (`/callback` on Cloudflare Worker) that dynamically forwards authenticated tokens back to the originating browser context (Chrome, Edge, Brave, Arc, or Local Dev) via state redirection.

### Requirement: Local Credential & Profile Caching
- Authentication tokens MUST be encrypted with AES-GCM via the Web Crypto API before persisting to `chrome.storage.local`.
- Plaintext personal access tokens MUST NEVER be stored unencrypted on disk.
- User profile metadata (`name`, `email`, `login`) MUST be stored locally in `chrome.storage.local`.
- User credentials MUST NEVER be transmitted to any third-party server other than official GitHub APIs.

### Requirement: Session Expiry, 401 Handling & Graceful Logout
- If a GitHub API request fails with HTTP 401 (`Bad credentials`, token expired, or token revoked), the extension MUST:
  1. Catch the authorization error via `isAuthError()`.
  2. Automatically wipe stale credentials and cached user profile data via `logout()`.
  3. Seamlessly transition the UI back to the login (`AuthForm`) view.
  4. Show a clean, polite toast notification (`"Session expired. Please reconnect your account."`) instead of displaying raw JSON error stack traces.
- When opening the popup with an expired token, background verification MUST automatically purge the invalid session without remaining in a broken logged-in state.

### Requirement: Target Repository Selection
- CodeSync MUST fetch the user's available repositories (`GET /user/repos`) supporting multi-page pagination (up to 500 repositories) and allow selecting a target repository.
- The selected repository choice MUST persist in `chrome.storage.local`.

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

### Requirement: Target Repository Selection
- CodeSync MUST fetch the user's available repositories (`GET /user/repos`) supporting multi-page pagination (up to 500 repositories) and allow selecting a target repository.
- The selected repository choice MUST persist in `chrome.storage.local`.

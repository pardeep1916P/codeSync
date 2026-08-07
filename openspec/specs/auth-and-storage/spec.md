# Authentication & Storage Capability Specification

## Overview
CodeSync manages user authentication securely using GitHub OAuth or Personal Access Tokens (PAT) and caches state in local browser storage.

## Requirements

### Requirement: Authentication Methods
- CodeSync MUST support GitHub OAuth authentication via `chrome.identity.launchWebAuthFlow()`.
- CodeSync MUST support manual GitHub Personal Access Token (PAT) authentication with `repo` scope.

### Requirement: Local Credential & Profile Caching
- Authentication tokens and user profile metadata (`name`, `email`, `login`) MUST be stored locally in `chrome.storage.local`.
- User credentials MUST NEVER be transmitted to any third-party server other than official GitHub APIs.

### Requirement: Target Repository Selection
- CodeSync MUST fetch the user's available repositories (`GET /user/repos`) and allow selecting a target repository.
- The selected repository choice MUST persist in `chrome.storage.local`.

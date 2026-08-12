# Core Sync Capability Specification

## Overview
CodeSync intercepts accepted coding problem submissions in real time, queues them safely in local storage, and performs atomic multi-file commits to the user's GitHub repository via the GitHub Git Trees REST API.

## Requirements

### Requirement: Real-Time Network Interception
- The extension MUST intercept `fetch` and `XMLHttpRequest` traffic on `leetcode.com`.
- Upon detecting a submission with `status_code === 10` (Accepted), it MUST post a message to the content script bridge containing submission metadata.

### Requirement: Queue & Deduplication
- Submissions MUST be held in a local queue managed via `chrome.storage.local`.
- If a submission with the same ID or problem slug is submitted multiple times, the queue MUST update existing items to avoid duplicate commits.

### Requirement: Atomic Single Commit Upload
- Submissions MUST be committed using the GitHub Git Trees API in a single atomic commit.
- Files committed per submission:
  1. Problem solution code file (`<slug>/<slug>.<ext>`)
  2. Problem README (`<slug>/README.md`)
  3. Repository root README (`README.md`)
  4. Repository statistics (`stats.json`)
- Commit author date MUST match the submission timestamp.

### Requirement: High Performance Sync
- Initial file reads (`problem/README.md`, `README.md`, `stats.json`) MUST be fetched in parallel using `Promise.allSettled`.
- File content < 100 KB MUST use inline `content` strings in `POST /git/trees` to minimize HTTP roundtrips.

### Requirement: Background Lifecycle & Update Detection
- The background service worker MUST listen to `chrome.runtime.onUpdateAvailable` to capture downloaded extension updates.
- A periodic alarm (`check-updates-alarm`) running every 60 minutes MUST trigger `chrome.runtime.requestUpdateCheck()` to discover new store versions.
- The service worker MUST handle `CHECK_FOR_UPDATES` and `APPLY_UPDATE` runtime message actions and notify storage/UI state.


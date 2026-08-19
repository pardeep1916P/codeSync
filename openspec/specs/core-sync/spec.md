# Core Sync Capability Specification

## Overview
CodeSync intercepts accepted coding problem submissions in real time, queues them safely in local storage, and performs atomic multi-file commits to the user's GitHub repository via the GitHub Git Trees REST API.

## Requirements

### Requirement: Real-Time Network Interception & Memory Bounding
- The extension MUST intercept `fetch` and `XMLHttpRequest` traffic on `leetcode.com`.
- Upon detecting a submission with `status_code === 10` (Accepted), it MUST post a message to the content script bridge containing submission metadata.
- In-memory submission tracking MUST be bounded (max 200 IDs) using an LRU queue to prevent memory leaks during long browser sessions.
- Persistent processed ID records in `chrome.storage.local` MUST automatically prune to a maximum threshold (500 items).

### Requirement: Queue, Deduplication & Unified Language System
- Submissions MUST be held in a local queue managed via `chrome.storage.local`.
- If a submission with the same ID or problem slug is submitted multiple times, the queue MUST update existing items to avoid duplicate commits.
- File extension mapping, human-readable display names, and markdown code fence IDs MUST be centralized in `src/utils/languages.ts` supporting 20+ programming languages (including C++, C, C#, Java, Python, JS, TS, Go, Rust, Kotlin, Swift, Ruby, Scala, PHP, Dart, Racket, Elixir, Erlang, SQL, R, Bash).
- Pending queue details in the popup MUST be loaded using batched storage reads (`chrome.storage.local.get(keys)`) rather than sequential round trips.

### Requirement: Atomic Single Commit & Bulk Queue Upload
- Submissions MUST be committed using the GitHub Git Trees API in a single atomic commit.
- Files committed per submission:
  1. Problem solution code file (`<slug>/<slug>.<ext>`)
  2. Problem README (`<slug>/README.md`)
  3. Repository root README (`README.md`)
  4. Repository statistics (`stats.json`)
- Commit author date MUST match the submission timestamp.
- When multiple submissions (e.g. 2 to 10+ problems) are queued, the queue engine MUST aggregate all problem files, READMEs, the root README table, and stats.json into a **Single Bulk Atomic Git Tree Commit** (`POST /git/trees` + `POST /git/commits`) with an aggregated commit summary, reducing network operations from 70+ requests down to 4 requests.

### Requirement: High Performance GraphQL Fetching, Chained SHAs & API Resilience
- Initial repository sync context (`README.md`, `stats.json`, branch ref, commit SHA, base tree SHA) MUST be fetched in a **single batched GraphQL request** (`fetchSyncContext()`) with transparent parallel REST fallback.
- In-memory chained commit SHAs MUST be propagated during sequential commits to eliminate GitHub CDN cache delay collisions and 409 fast-forward errors.
- File content < 100 KB MUST use inline `content` strings in `POST /git/trees` to minimize HTTP roundtrips.
- GitHub API client MUST implement exponential backoff retry for transient network errors and HTTP 429 rate limit responses.
- User profile (`name`, `email`) and default branch MUST be cached in memory to eliminate redundant GET requests during commit author creation.
- DOM fallback query intervals on LeetCode tabs MUST automatically pause when the tab is backgrounded (`document.hidden`).

### Requirement: Background Lifecycle, Recovery & Update Detection
- Background service worker initialization (`onStartup`, `onInstalled`, top-level module load) MUST automatically clear any stale `codesync_is_syncing: true` lock to prevent the popup UI from freezing if the worker is abruptly terminated by Chrome during a network sync.
- The background service worker MUST listen to `chrome.runtime.onUpdateAvailable` to capture downloaded extension updates.
- A periodic alarm (`check-updates-alarm`) running every 60 minutes MUST trigger `chrome.runtime.requestUpdateCheck()` to discover new store versions.
- The service worker MUST handle `CHECK_FOR_UPDATES` and `APPLY_UPDATE` runtime message actions and notify storage/UI state.

### Requirement: Historical Submissions Sync & Multi-Platform Guarding
- CodeSync MUST provide a user-configurable toggle `syncHistoricalOnView` (default `false`) in storage settings.
- Active judging events (`/check/`, `submissionProgress`) MUST always be processed in real time regardless of the historical setting.
- Past submissions viewed via the platform's history tab or direct historical URL visits (timestamp > 5 minutes ago) MUST be discarded immediately when `syncHistoricalOnView === false`.
- When `syncHistoricalOnView === true`, historical submissions MUST be queued/synced using their original accepted timestamp (`timestamp * 1000`) without altering or overwriting newer solutions in identical languages.



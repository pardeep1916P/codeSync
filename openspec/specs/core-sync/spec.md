# Core Sync Capability Specification

## Overview
CodeSync intercepts accepted coding problem submissions in real time, queues them safely in local storage, and performs atomic multi-file commits to the user's GitHub repository via the GitHub Git Trees REST API.

## Requirements

### Requirement: Real-Time Network Interception & Native MV3 Main World
- The extension MUST register network interceptors natively via Chrome Manifest V3 `content_scripts` with `"world": "MAIN"` and `"run_at": "document_start"`.
- The interceptor MUST monkey-patch `window.fetch` and `XMLHttpRequest` in the page's native JavaScript context before any page scripts evaluate.
- Upon detecting a submission with `status_code === 10` (Accepted), it MUST post a message to the content script bridge containing submission metadata.
- Question metadata (`title`, `slug`, `difficulty`, `content`, `tags`) MUST be pre-cached on page load via `CODESYNC_QUESTION_METADATA` so that submissions enqueue in < 10ms with zero extra network roundtrips.
- In-memory submission tracking MUST be bounded (max 200 IDs) using high-performance O(1) `LRUCache`.

### Requirement: Queue, Deduplication & Configurable Directory Layout
- Submissions MUST be held in a local queue managed via `chrome.storage.local`.
- If a submission with the same ID or problem slug is submitted multiple times, the queue MUST update existing items to avoid duplicate commits.
- File extension mapping, human-readable display names, and markdown code fence IDs MUST be centralized across platform adapters.
- Target folder layout MUST support user-configurable templates:
  1. `Flat Mode`: `{problem_slug}/`
  2. `Platform Namespaced`: `{platform}/{problem_slug}/`
  3. `Difficulty Grouped`: `{platform}/{difficulty}/{problem_slug}/`
- Pending queue details in the popup MUST be loaded using batched storage reads (`chrome.storage.local.get(keys)`) rather than sequential round trips.

### Requirement: Authentic Historical Timestamps & Chronological Git Sync
- Submissions MUST be committed using the GitHub Git Trees API.
- For all commits (live or historical), BOTH `author.date` and `committer.date` MUST be explicitly set to the ISO 8601 timestamp (`new Date(submission.timestamp).toISOString()`).
- Pending submissions MUST be sorted chronologically from oldest to newest before Git tree generation.
- Historical commits MUST preserve the original solve date in GitHub commit history and properly reflect on the GitHub contribution activity graph.

### Requirement: High Performance GraphQL Fetching, Chained SHAs & API Resilience
- Initial repository sync context (`README.md`, `stats.json`, branch ref, commit SHA, base tree SHA) MUST be fetched in a **single batched GraphQL request** (`fetchSyncContext()`) with transparent parallel REST fallback.
- In-memory chained commit SHAs MUST be propagated during sequential commits to eliminate GitHub CDN cache delay collisions and 409 fast-forward errors.
- File content < 100 KB MUST use inline `content` strings in `POST /git/trees` to minimize HTTP roundtrips.
- GitHub API client MUST implement exponential backoff retry for transient network errors and HTTP 429 rate limit responses.
- User profile (`name`, `email`) and default branch MUST be cached in memory to eliminate redundant GET requests during commit author creation.
- DOM fallback query intervals on coding tabs MUST automatically pause when the tab is backgrounded (`document.hidden`).

### Requirement: Background Lifecycle, Centralized Logging & Recovery
- Background service worker MUST collect centralized diagnostic logs from interceptors, content scripts, popup, and queue via `action: 'LOG'` messages for single-pane debugging in the Service Worker console.
- Background service worker initialization (`onStartup`, `onInstalled`, top-level module load) MUST automatically clear any stale `codesync_is_syncing: true` lock.
- The background service worker MUST listen to `chrome.runtime.onUpdateAvailable` to capture downloaded extension updates.
- A periodic alarm (`check-updates-alarm`) running every 60 minutes MUST trigger `chrome.runtime.requestUpdateCheck()` to discover new store versions.

### Requirement: Historical Submissions Sync & Multi-Platform Extensibility
- CodeSync MUST provide a user-configurable toggle `syncHistoricalOnView` (default `false`) in storage settings.
- Active judging events (`/check/`, `submissionProgress`) MUST always be processed in real time regardless of the historical setting.
- Past submissions viewed via the platform's history tab or direct historical URL visits (timestamp > 5 minutes ago) MUST be discarded immediately when `syncHistoricalOnView === false`.
- When `syncHistoricalOnView === true`, historical submissions MUST be queued/synced using their original accepted timestamp without altering or overwriting newer solutions in identical languages.
- The system MUST use a modular `PlatformAdapter` interface (`src/platforms/`) to support LeetCode, Codeforces, HackerRank, and GeeksforGeeks.



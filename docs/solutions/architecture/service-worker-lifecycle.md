# Compound Learning: Manifest V3 Service Worker Lifecycle & Sync Lock Recovery

## Context & Problem
In Chrome Manifest V3, background pages were replaced by event-driven **Service Workers**. Service workers are ephemeral: Chrome aggressively terminates them after 30 seconds of inactivity or abruptly when system resources are constrained.

If a service worker is terminated midway through processing a network sync:
1. `codesync_is_syncing: true` persisted in `chrome.storage.local`.
2. Upon reopening the popup, the store read `isSyncing: true` and remained permanently frozen on `"Syncing..."` because the worker was no longer running.

## Solution
1. **Startup & Module Load Resets**:
   In `src/background/index.ts`, the sync lock is unconditionally cleared on:
   - Module initialization
   - `chrome.runtime.onStartup`
   - `chrome.runtime.onInstalled`

2. **Atomic Commits with Git Trees API**:
   Instead of uploading 4 separate files via 4 sequential commits (which risks partial sync failures if interrupted), all files are batched into a single Git Tree and committed atomically in one SHA update.

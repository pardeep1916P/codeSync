# Phase 1 Summary: Core Integration & Theme System

This document outlines the core architecture and feature set implemented during **Phase 1** of CodeSync development.

---

## 🛠️ Implemented Architecture & Modules

### 1. Extension Skeleton & Build System
* **Tech Stack**: React 18, TypeScript, Tailwind CSS, Zustand, Vite.
* **Manifest**: Migrated to Manifest V3 (`public/manifest.json`) supporting service workers (`dist/background.js`) and content scripts (`dist/content.js`).

### 2. Network request interception (GraphQL Parser)
* **Location**: [src/content/index.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/content/index.ts)
* **Mechanism**: Injects a page-level script (Main World context) that monkey-patches `window.fetch` and `XMLHttpRequest`.
* **Flow**: Intercepts LeetCode GraphQL calls to `/graphql`. Fires message-passing events (`CODESYNC_SUBMISSION_ACCEPTED`, `CODESYNC_JUDGING_ACCEPTED`) to the content script upon detecting `statusCode: 10` (Accepted).
* **Details Fetching**: The content script queries LeetCode's `/graphql` endpoint for full details (`submissionDetails`) using the intercepted submission ID, retrieving the submitted code, question data, language, and difficulty.

### 3. Queue Manager & Git Trees client
* **Location**: [src/queue/index.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/queue/index.ts) and [src/github/client.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/github/client.ts)
* **Atomic Commits**: Uses the GitHub Trees API to push multiple files (e.g. source file, problem description `README.md`, and updated root stats `README.md`) in a **single atomic Git commit**.
* **Deduplication**: Automatically cleans up and replaces older pending entries of the same problem slug in the queue, ensuring only the latest accepted code is synced.
* **Serialization**: Uses a sequential Promise chain inside `CommitQueue` to guarantee that enqueuing events are processed in order and avoid storage write races.

### 4. Storage & State Caching
* **Location**: [src/store/index.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/store/index.ts) and [src/storage/index.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/storage/index.ts)
* **Instant Load**: Implemented two-phase loading in the Zustand store: Phase 1 loads cached configurations and user settings instantly from local Chrome storage; Phase 2 silently refreshes API data from GitHub in the background.
* **Merging Defaults**: Merges local configurations with `DEFAULT_SETTINGS` using object spreading to ensure newly introduced keys (like `syncOnAccept`) default cleanly.

### 5. Multi-Theme UI System
* **Location**: [src/styles/themes.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/styles/themes.ts) and [src/popup/Popup.tsx](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/popup/Popup.tsx)
* **Themes**: Implemented a collection of 15+ modern themes (AMOLED, Catppuccin, Tokyo Night, Tokyo Day, Nord, Cyberpunk, Matrix, Dracula, etc.). The default theme is AMOLED.
* **Queue Panel**: Added UI elements to preview the pending queue items, delete specific submissions, and clear the entire queue manually.
* **Instant Sync Toggle**: A fully clickable label-wrapped toggle for turning instant synchronization on or off.

---

## 🔒 Configuration Variables

* **`syncOnAccept`**: When `true`, pushes solutions immediately to GitHub on acceptance. When `false`, holds submissions in the queue.
* **`process-queue-alarm`**: A 5-minute periodic alarm registered in the background service worker. Respects the toggle and skips execution if instant sync is off.

---

## 📈 Next Objectives (Phase 2)
* Custom folders layout and path configuration.
* Repository initialization upgrades and folder-level naming custom tags.
* Supporting custom readme structure templates.

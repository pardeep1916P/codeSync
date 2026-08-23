# Phase 6: CodeChef Adapter, Difficulty Default Layout & In-Repo Preference Sync

## Summary of Accomplishments

### 1. CodeChef Platform Adapter (`src/platforms/codechef/index.ts`)
- **Domain Pattern**: Added support for `codechef.com`.
- **Language Map**: Mapped CodeChef language extensions (C++, Java, Python, C, C#, Kotlin, Rust, Go, JS, TS, Swift, Ruby, PHP).
- **Difficulty Normalization**: Added `normalizeDifficulty()` to map CodeChef rating tiers and division categories (`School` -> `Easy`, `<1400` -> `Easy`, `1400-1800` -> `Medium`, `>1800` / `Challenge` -> `Hard`).
- Registered in `src/platforms/registry.ts` and `src/platforms/types.ts`.

### 2. Default Repository Layout to `Difficulty Grouped`
- Updated default repository folder structure layout from `flat` to **`difficulty`** (`{platform}/{difficulty}/{problem_slug}/`).
- Configured as default in:
  - `src/storage/index.ts` (`DEFAULT_SETTINGS`)
  - `src/store/index.ts` (Initial store state)
  - `src/queue/index.ts` (Commit path generator fallback)
  - `src/options/Options.tsx` (UI layout selector fallback)

### 3. In-Repository Preference Synchronization (`codesync_state`)
- **Problem**: When a user switches browsers (e.g. Chrome to Edge) or sets up CodeSync on a new laptop, their repository layout and sync rules were lost, potentially causing folder structure collisions in the same repository.
- **Solution**:
  - Saved an opaque, base64-encoded sync state string (`codesync_state`) inside `stats.json` in the root of the repository:
    ```json
    {
      "solved": 15,
      "codesync_state": "cs:eyJsYXlvdXQiOiJkaWZmaWN1bHR5Iiwic3luY09uQWNjZXB0Ijp0cnVlLCJzeW5jSGlzdG9yaWNhbE9uVmlldyI6ZmFsc2UsImRlc2t0b3BOb3RpZmljYXRpb25zIjpmYWxzZSwidGhlbWUiOiJkcmFjdWxhIn0=",
      "shas": { ... }
    }
    ```
  - **Synchronized Preferences**:
    1. `layout`: Folder layout structure (`difficulty`, `platform`, `flat`)
    2. `syncOnAccept`: Instant Sync on Accept toggle
    3. `syncHistoricalOnView`: Historical Submissions Sync toggle
    4. `desktopNotifications`: Desktop OS Notifications toggle
    5. `theme`: Active UI Theme (`amoled`, `dracula`, `tokyo_night`, etc.)
  - **Automatic Restoration**: When logging in, selecting a repository, or launching the extension, `parseRepoCodesyncState()` in `src/store/index.ts` automatically decodes and applies the saved repository settings to local browser storage and UI state.

### 4. Automated Microsoft Edge Add-ons CI/CD Pipeline
- Enabled automated publishing for Microsoft Edge Add-ons in `.github/workflows/release.yml` using `wdzeng/edge-addon@v2`.
- Synchronizes automated store deployments across Chrome Web Store and Microsoft Edge Add-ons on every tagged Git release.

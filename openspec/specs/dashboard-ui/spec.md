# Dashboard UI Capability Specification

## Overview
CodeSync provides an intuitive, high-performance React dashboard popup with modular component architecture, theme customization, dynamic versioning, in-app update notifications, and real-time sync control.

## Requirements

### Requirement: Modular Component Architecture
- The popup and options UI MUST be decomposed into modular single-responsibility components:
  - `Header.tsx`: Title bar, GitHub data refresh trigger, theme dropdown toggle, and options launcher.
  - `UpdateBanner.tsx`: Update notification card with immediate "Update Now" action.
  - `UserProfileCard.tsx`: User avatar, username, active status indicator, and logout.
  - `RepoSelector.tsx`: Target repository selector with public/private badges, solved problem count, and guided onboarding banner for first-time users.
  - `SyncControl.tsx`: Auto-sync status badge, real-time sync progression indicator (`SYNC_IN_PROGRESS`), trigger manual sync button, clear queue, and collapsible pending queue list.
  - `AuthForm.tsx`: OAuth and Personal Access Token (PAT) connection forms.
  - `ConfirmModal.tsx`: Shared theme-aware confirmation dialogs with backdrop blur for destructive actions (shared between popup and options).
  - `Footer.tsx`: Dynamic version display (`codesync v${version}`) and "check updates" trigger.

### Requirement: In-App Update Notification & Resilient Version Checks
- The popup MUST query the store/background service worker for update availability.
- When an update is detected, an `UpdateBanner` MUST be displayed informing the user of the new version with an **"Update Now"** button.
- Clicking **"Update Now"** MUST immediately trigger `chrome.runtime.reload()` to reload the extension with the updated package.
- The footer MUST provide a manual **"check updates"** button.
- Update check statuses `no_update` and `throttled` (frequent polling) MUST both be handled gracefully as up-to-date notifications without raising error alerts.

### Requirement: Dynamic Versioning & Options Page Architecture
- UI components MUST NOT hardcode static version numbers.
- The extension version MUST be dynamically retrieved from the extension manifest via `chrome.runtime.getManifest().version`.
- The Options (Settings) page MUST provide distinct, modal-confirmed actions for:
  1. *Clear Pending Queue*: Flushes queued submissions without disconnecting user credentials.
  2. *Reset Extension Settings*: Full credential and settings wipe.
- Notification toasts on the Options page MUST be horizontally centered at the bottom of the viewport using Flexbox containers to prevent CSS transform animation conflicts.

### Requirement: Real-Time Sync Status, Layout Integrity & Guided Onboarding
- The popup MUST enforce a fixed `h-[480px] w-[360px]` container with a scrollable `overflow-y-auto no-scrollbar` main content area so footer elements and pending queues are never underlaid or pushed off-screen.
- The popup header MUST show the current Auto-Sync status (Active/Paused/Committing).
- When a sync is actively in progress, the manual trigger button MUST display an integrated spinner with `SYNCING_QUEUE...` state, keeping the control card compact without layout shift.
- When no target repository is selected, a contextual guided onboarding card MUST assist the user in choosing a repository.
- The popup MUST show the total count of solved problems and pending queue size.

### Requirement: Theme Token System
- The UI MUST support 15+ curated dark/light themes (AMOLED, Dracula, Tokyo Night, Cyberpunk, Matrix, Nord, etc.).
- Selected theme preference MUST persist in `chrome.storage.local`.
- Dropdowns and scrollable containers MUST use styled dark scrollbars matching the active theme palette.

### Requirement: Radix & shadcn/ui Switches & History Sync Badge
- Form toggles (such as *Instant Sync on Accept* and *Historical Submissions Sync*) MUST use accessible Radix UI primitives with smooth sliding thumbs (`@radix-ui/react-switch` and `@radix-ui/react-label`).
- When `syncHistoricalOnView` is `false`, the popup UI MUST remain completely clean with zero badges representing historical sync.
- When `syncHistoricalOnView` is `true`, a badge `[HIST_SYNC: ACTIVE]` MUST be rendered to the **left** of the `AUTO_SYNC` badge without displacing or causing layout shift to the `AUTO_SYNC` badge.

### Requirement: Pending Queue Management
- Users MUST be able to view, delete, or manually trigger sync for queued submissions.



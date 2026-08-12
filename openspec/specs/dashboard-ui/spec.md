# Dashboard UI Capability Specification

## Overview
CodeSync provides an intuitive, high-performance React dashboard popup with modular component architecture, theme customization, dynamic versioning, in-app update notifications, and real-time sync control.

## Requirements

### Requirement: Modular Component Architecture
- The popup UI MUST be decomposed into modular single-responsibility components:
  - `Header.tsx`: Title bar, GitHub data refresh trigger, theme dropdown toggle, and options launcher.
  - `UpdateBanner.tsx`: Update notification card with immediate "Update Now" action.
  - `UserProfileCard.tsx`: User avatar, username, active status indicator, and logout.
  - `RepoSelector.tsx`: Target repository selector with public/private badges and solved problem count.
  - `SyncControl.tsx`: Auto-sync status badge, trigger manual sync button, clear queue, and collapsible pending queue list.
  - `AuthForm.tsx`: OAuth and Personal Access Token (PAT) connection forms.
  - `ConfirmModal.tsx`: Theme-aware confirmation dialogs for destructive actions.
  - `Footer.tsx`: Dynamic version display (`codesync v${version}`) and "check updates" trigger.

### Requirement: In-App Update Notification & Reload
- The popup MUST query the store/background service worker for update availability.
- When an update is detected, an `UpdateBanner` MUST be displayed informing the user of the new version with an **"Update Now"** button.
- Clicking **"Update Now"** MUST immediately trigger `chrome.runtime.reload()` to reload the extension with the updated package.
- The footer MUST provide a manual **"check updates"** button to check the Chrome Web Store on demand.

### Requirement: Dynamic Versioning
- UI components MUST NOT hardcode static version numbers.
- The extension version MUST be dynamically retrieved from the extension manifest via `chrome.runtime.getManifest().version`.

### Requirement: Real-Time Sync Status
- The popup header MUST show the current Auto-Sync status (Active/Paused).
- The popup MUST show the total count of solved problems and pending queue size.

### Requirement: Theme Token System
- The UI MUST support 15+ curated dark/light themes (AMOLED, Dracula, Tokyo Night, Cyberpunk, Matrix, Nord, etc.).
- Selected theme preference MUST persist in `chrome.storage.local`.

### Requirement: Pending Queue Management
- Users MUST be able to view, delete, or manually trigger sync for queued submissions.


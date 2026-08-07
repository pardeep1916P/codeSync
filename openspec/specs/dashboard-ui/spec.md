# Dashboard UI Capability Specification

## Overview
CodeSync provides an intuitive, high-performance React dashboard popup with theme customization and real-time sync control.

## Requirements

### Requirement: Real-Time Sync Status
- The popup header MUST show the current Auto-Sync status (Active/Paused).
- The popup MUST show the total count of solved problems and pending queue size.

### Requirement: Theme Token System
- The UI MUST support 15+ curated dark/light themes (AMOLED, Dracula, Tokyo Night, Cyberpunk, Matrix, Nord, etc.).
- Selected theme preference MUST persist in `chrome.storage.local`.

### Requirement: Pending Queue Management
- Users MUST be able to view, delete, or manually trigger sync for queued submissions.

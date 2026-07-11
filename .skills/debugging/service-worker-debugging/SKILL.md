---
name: service-worker-debugging
description: Debugging service worker registration, wake-up events, alarm triggers, and termination states in CodeSync.
---

# Service Worker Debugging

## Purpose & Scope
Worker logs tracking.

## Checklists
- [ ] Verify registered alarms are active.

## Decision Tree
`
Need to work on service-worker-debugging?
â”œâ”€ Align with CodeSync development roadmap
â”œâ”€ Follow Manifest V3 extension standards
â””â”€ Run lint and tests before committing
`

## Implementation Patterns
Refer to the CodeSync codebase for implementation patterns matching:
- [src/storage/index.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/storage/index.ts) for storage settings
- [src/queue/index.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/queue/index.ts) for queue workflows
- [src/background/index.ts](file:///c:/Users/chait/OneDrive/Desktop/codeSync/src/background/index.ts) for alarms and service workers

## Troubleshooting Guide
- If compiling fails, run 
pm run lint and verify types.
- Check extension background logs for runtime errors.

## References
- [Chrome Developer Documentation](https://developer.chrome.com/)
- [Vite Bundler Guide](https://vitejs.dev/)

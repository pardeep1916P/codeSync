---
name: release-manager
description: Extension release checklists, building deployment assets, and tagging versions in Git.
---

# Release Manager

## Purpose & Scope
Release packaging steps.

## Checklists
- [ ] Run 
pm run build to verify bundles.

## Decision Tree
`
Need to work on release-manager?
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

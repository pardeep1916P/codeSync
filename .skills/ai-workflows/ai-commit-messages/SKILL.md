---
name: ai-commit-messages
description: Leveraging AI assistance to format conventional commits and draft release logs.
---

# AI Commit Messages

## Purpose & Scope
How to utilize AI to write clean, Conventional Commits matching CodeSync standards.

## Decision Tree
`
Generate commit message with AI?
â”œâ”€ Analyze Git diff output
â”œâ”€ Map changes to correct type:
â”‚  â”œâ”€ New feature â†’ feat
â”‚  â”œâ”€ Bug fix â†’ fix
â”‚  â”œâ”€ Documentation â†’ docs
â”‚  â””â”€ Refactoring â†’ refactor
â””â”€ Scope determination:
   â””â”€ Select from (sync, content, popup, options, storage, store, github)
`

## Checklists
- [ ] Commit subject line is under 72 characters.
- [ ] Formatted exactly as: type(scope): message.

## Decision Tree
`
Need to work on ai-commit-messages?
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

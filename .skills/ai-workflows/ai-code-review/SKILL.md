---
name: ai-code-review
description: Using AI models to audit code, review safety features, and ensure performance best practices.
---

# AI Code Review

## Purpose & Scope
This skill provides instructions for utilizing AI-assisted workflows to audit CodeSync code, verify Chrome MV3 compatibility, check for data privacy, and identify performance improvements.

## Decision Tree
`
Need to audit CodeSync code with AI?
â”œâ”€ Is it a service worker or popup UI?
â”‚  â”œâ”€ Service Worker â†’ Audit for lifecycle states, global variable leaks, and alarms
â”‚  â””â”€ Popup UI â†’ Audit for React renders, theme applications, and state syncs
â”œâ”€ Inspecting for security?
â”‚  â”œâ”€ Verify no secrets (GitHub token) are printed or stored insecurely
â”‚  â””â”€ Ensure no innerHTML is used on user-controlled inputs
â””â”€ Auditing performance?
   â””â”€ Check for redundant storage read/write calls
`

## Architecture & Concepts
When conducting an AI-assisted code review:
1. Validate against MV3 specifications.
2. Confirm the extension handles background workers going idle.
3. Verify that storage updates do not trigger race conditions.

## Implementation Patterns
### Sample AI Review Prompt
Use this prompt when asking an AI model to review code:
`
Please review this Chrome Extension code. Pay specific attention to:
1. Chrome Manifest V3 service worker lifecycle constraints (no global variables, event-driven listeners).
2. Proper error catching for chrome.runtime.lastError.
3. Secure usage of storage APIs (no secrets in sync storage).
4. Prevention of XSS vulnerabilities.
`

## Checklists
- [ ] Ensure the AI review checks for chrome.runtime.lastError callback handlers.
- [ ] Confirm that no sensitive information is logged to the console.
- [ ] Check for proper cleanup of event listeners in React custom hooks.

## References
- [Chrome Extension MV3 Development](https://developer.chrome.com/docs/extensions/mv3/)

## Decision Tree
`
Need to work on ai-code-review?
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

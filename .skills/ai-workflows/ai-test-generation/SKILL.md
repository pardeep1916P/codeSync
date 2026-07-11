---
name: ai-test-generation
description: Generating unit and integration tests with AI models for Vitest validation suites.
---

# AI Test Generation

## Purpose & Scope
Guides how to prompt AI to write unit and integration tests using Vitest, mock Chrome extension APIs, and test edge cases.

## Decision Tree
`
Generate tests using AI?
â”œâ”€ What module is being tested?
â”‚  â”œâ”€ Storage Module â†’ Mock chrome.storage.local.get/set APIs
â”‚  â”œâ”€ Queue Module â†’ Mock submission payloads, promise chains, and path generators
â”‚  â””â”€ GitHub Client â†’ Mock fetch request responses and errors (401, 403, 409)
â””â”€ Writing mock files?
   â””â”€ Use vitest vi.fn() mock utilities
`

## Implementation Patterns
### Prompting for Vitest Unit Tests
`
Write a Vitest unit test for this utility function.
Mock any global chrome.storage calls.
Ensure all test cases use vi.fn() and clear all mock states in beforeEach().
`

## Checklists
- [ ] Verify generated tests cover negative and edge cases (null, empty strings).
- [ ] Ensure Vitest mocks are reset between test runs to avoid leakages.

## Decision Tree
`
Need to work on ai-test-generation?
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

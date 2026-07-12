---
name: storage-performance
description: Efficient storage API calls, bulk read/writes, and storage cache optimization policies in CodeSync.
---

# Storage Performance

## Purpose & Scope
Details best practices for storage read/write performance, batching operations, and avoiding quota limit blockages.

## Implementation Patterns
### Batched Storage Write
`	ypescript
// BAD: Triggering multiple storage writes in a loop
for (const [key, value] of Object.entries(updates)) {
  await chrome.storage.local.set({ [key]: value });
}

// GOOD: Write everything at once
await chrome.storage.local.set(updates);
`

## Checklists
- [ ] Operations are batched instead of executed in individual loops.
- [ ] Use Two-Phase caching in store initializations to load from local cache instantly.

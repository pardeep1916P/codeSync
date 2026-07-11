---
name: memory-management
description: Memory management guidelines, event listener cleanup, and memory leak prevention patterns in React and content scripts.
---

# Memory Management

## Purpose & Scope
Instructions on preventing memory leaks, disconnecting mutation observers, and removing listeners in background and content environments.

## Implementation Patterns
### Cleaning Up Observers & Listeners
`	ypescript
// React Listener Cleanup
useEffect(() => {
  const handler = (msg: any) => console.log(msg);
  chrome.runtime.onMessage.addListener(handler);
  return () => {
    chrome.runtime.onMessage.removeListener(handler); // CLEANUP
  };
}, []);
`

## Checklists
- [ ] Disconnect all MutationObservers on navigation.
- [ ] Clean up event listeners in React component unmount hook.
- [ ] Avoid large in-memory caches that survive indefinitely in background.

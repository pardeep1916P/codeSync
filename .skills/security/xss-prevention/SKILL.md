---
name: xss-prevention
description: Cross-Site Scripting (XSS) prevention guidelines for rendering user-controlled content in options, popups, and content scripts.
---

# Cross-Site Scripting (XSS) Prevention

## Purpose & Scope
This document outlines standard guidelines to prevent Cross-Site Scripting (XSS) in popup pages, options dashboards, and DOM injections on LeetCode.

## Decision Tree
`
Need to update DOM with dynamic content?
â”œâ”€ Is it from a trusted source?
â”‚  â”œâ”€ Yes (internal string) â†’ Safe to assign, but prefer textContent
â”‚  â””â”€ No (user code, description) â†’ Escape or sanitize
â”œâ”€ Using React?
â”‚  â”œâ”€ Default rendering (e.g. <div>{content}</div>) â†’ Automatically escaped! âœ“
â”‚  â””â”€ dangerouslySetInnerHTML â†’ AVOID. If necessary, use DOMPurify first.
â””â”€ Injected via content script?
   â””â”€ Use textContent instead of innerHTML to bind problem titles/difficulties.
`

## Implementation Patterns
### Safe Content Injections
`	ypescript
// BAD: vulnerable to XSS if title contains malicious HTML
const container = document.createElement('div');
container.innerHTML = <h3></h3>;

// GOOD: textContent escapes everything automatically
const container = document.createElement('div');
const header = document.createElement('h3');
header.textContent = problemTitle;
container.appendChild(header);
`

## Checklists
- [ ] Avoid dangerouslySetInnerHTML in React components.
- [ ] Avoid innerHTML in content script DOM operations.
- [ ] Sanitize external problem content using robust string parsing.

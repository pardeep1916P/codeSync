---
name: pr-review
description: Pull request review workflows, review checklists, and automated review patterns for CodeSync development.
---

# PR Review — Code Review Workflows & Checklists

## Purpose & Scope

Use this skill when reviewing pull requests for the CodeSync extension, setting up review automation, or establishing review standards.

---

## PR Review Checklist

### Functional Review
- [ ] Feature works as described in PR description
- [ ] Edge cases handled (empty queue, no token, network failure)
- [ ] No regressions in existing functionality
- [ ] Error messages are user-friendly

### Code Quality Review
- [ ] TypeScript types are strict (no `any` unless justified)
- [ ] Functions are focused (single responsibility)
- [ ] No duplicated logic (DRY)
- [ ] Comments explain WHY, not WHAT
- [ ] Console.log statements prefixed with `[CodeSync]`

### Extension-Specific Review
- [ ] Service worker listeners at top-level synchronous scope
- [ ] No global mutable state in background worker
- [ ] chrome.runtime.lastError checked in all callbacks
- [ ] sendMessage has `.catch()` for closed receivers
- [ ] Storage reads merge with DEFAULT_SETTINGS
- [ ] Content script interceptors wrapped in try-catch
- [ ] No eval(), new Function(), or remote code loading

### Security Review
- [ ] No secrets in client code (tokens only from storage)
- [ ] No innerHTML with untrusted data
- [ ] postMessage validates source/origin
- [ ] GitHub token has minimum required scopes
- [ ] CSP not weakened

### Performance Review
- [ ] No blocking operations in service worker
- [ ] Bundle size impact assessed
- [ ] Storage quota impact assessed
- [ ] No memory leaks (observers disconnected, listeners removed)

### Testing Review
- [ ] Unit tests for new logic
- [ ] Edge cases tested (null, undefined, empty arrays)
- [ ] Existing tests still pass
- [ ] Manual testing instructions in PR description

---

## PR Description Template

```markdown
## What
Brief description of what this PR does.

## Why
The motivation for this change.

## How
Technical approach and key design decisions.

## Testing
- [ ] Unit tests pass (`npm run test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing: [describe steps]

## Screenshots
If UI changes, include before/after screenshots.

## Checklist
- [ ] Code follows project coding standards
- [ ] Self-reviewed the code
- [ ] Documentation updated if needed
```

---

## References

- [Google Code Review Guidelines](https://google.github.io/eng-practices/review/)
- [GitHub Pull Request Reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests)

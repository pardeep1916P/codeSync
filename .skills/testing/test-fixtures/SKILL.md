---
name: test-fixtures
description: Test fixture management, factory functions, and test data generation for CodeSync unit and integration tests.
---

# $args[0].Value.ToUpper()est$args[0].Value.ToUpper()ixtures

## Purpose & Scope

Test fixture management, factory functions, and test data generation for CodeSync unit and integration tests.

## When to Use

- Automatically when this topic matches the development task
- When writing or reviewing tests for CodeSync modules
- When improving test infrastructure

## Decision Tree

```
Testing task?
├─ Unit test? → See unit-testing skill
├─ Integration? → Test module interactions with mocked boundaries
├─ E2E? → See e2e-testing skill
├─ Mocking? → See mock-strategies skill
└─ Coverage? → See coverage-analysis skill
```

## CodeSync-Specific Patterns

### Key Modules to Test

| Module | Test Focus | Mock Requirements |
|--------|-----------|-------------------|
| queue/index.ts | Dedup, enqueue, process | chrome.storage, fetch |
| storage/index.ts | Settings merge, cache | chrome.storage.local |
| content/index.ts | Interception, messaging | window.fetch, postMessage |
| github/client.ts | API calls, error handling | fetch |
| store/index.ts | State init, two-phase load | chrome.storage, fetch |

### Testing Utilities

```typescript
// Test helper: create a mock submission
function createMockSubmission(overrides?: Partial<SubmissionData>): SubmissionData {
  return {
    id: '12345',
    problem: {
      title: 'Two Sum',
      titleSlug: 'two-sum',
      difficulty: 'Easy',
    },
    language: 'java',
    code: 'class Solution { }',
    timestamp: Date.now(),
    ...overrides,
  };
}

// Test helper: create mock settings
function createMockSettings(overrides?: Partial<Settings>): Settings {
  return {
    githubToken: 'ghp_test_token',
    selectedRepo: 'user/leetcode-solutions',
    syncOnAccept: false,
    commitQueue: [],
    folderStructure: 'difficulty',
    theme: 'amoled',
    commitPrefix: 'feat(solve):',
    syncInterval: 5,
    ...overrides,
  };
}
```

## Checklists

- [ ] All mocks reset between tests (beforeEach)
- [ ] Async operations properly awaited
- [ ] Edge cases covered (empty arrays, null values, network errors)
- [ ] Test names describe expected behavior
- [ ] No tests depend on execution order
- [ ] Coverage thresholds configured and enforced

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/develop/concepts/testing)

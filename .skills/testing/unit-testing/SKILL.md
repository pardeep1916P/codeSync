---
name: unit-testing
description: Unit testing strategies with Vitest for the CodeSync extension — testing queue logic, storage operations, README generation, and utility functions.
---

# Unit Testing — Vitest Strategies for CodeSync

## Purpose & Scope

Use this skill when writing unit tests for CodeSync modules, setting up test infrastructure, mocking Chrome APIs, or establishing test coverage targets.

---

## Architecture & Concepts

### Test Structure

```
src/
├── queue/__tests__/
│   ├── readmeTable.test.ts   ← README generation tests
│   ├── deduplication.test.ts ← Queue dedup tests
│   └── fileExtension.test.ts ← Language mapping tests
├── readme/__tests__/
│   └── readme.test.ts        ← Root README builder tests
├── storage/__tests__/
│   └── storage.test.ts       ← Settings merge tests
└── github/__tests__/
    └── client.test.ts         ← API client tests
```

### Testing Pyramid for Extensions

```
         ╱╲
        ╱  ╲         E2E (manual in Chrome)
       ╱────╲
      ╱      ╲       Integration (content + background)
     ╱────────╲
    ╱          ╲     Unit (pure logic, mocked chrome.*)
   ╱────────────╲
```

---

## Implementation Patterns

### Pattern 1: Chrome API Mocking

```typescript
// src/__mocks__/chrome.ts

const mockStorage: Record<string, unknown> = {};

export const chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          if (mockStorage[key] !== undefined) result[key] = mockStorage[key];
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) delete mockStorage[key];
      }),
      getBytesInUse: vi.fn((_, cb) => cb(0)),
      QUOTA_BYTES: 10_485_760,
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(async () => ({})),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null,
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
  },
  notifications: {
    create: vi.fn((id, opts, cb) => cb && cb()),
  },
  alarms: {
    create: vi.fn(),
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    clear: vi.fn(async () => true),
    clearAll: vi.fn(async () => {}),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
};

// Reset between tests
export function resetMockStorage(): void {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
}

// Setup in vitest.config.ts or setup file
(globalThis as any).chrome = chrome;
```

### Pattern 2: Testing Queue Deduplication

```typescript
// src/queue/__tests__/deduplication.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommitQueue } from '../index';
import { storage } from '../../storage';

vi.mock('../../storage');

describe('CommitQueue deduplication', () => {
  let queue: CommitQueue;
  
  beforeEach(() => {
    queue = new CommitQueue('test-token');
    vi.clearAllMocks();
  });
  
  it('should replace older submission for same problem', async () => {
    const sub1 = { id: '100', problem: { titleSlug: 'two-sum' } };
    const sub2 = { id: '200', problem: { titleSlug: 'two-sum' } };
    
    vi.mocked(storage.getSettings).mockResolvedValue({
      commitQueue: ['100'],
    });
    vi.mocked(storage.getSubmission).mockResolvedValue(sub1);
    
    await queue.enqueue('200', sub2);
    
    expect(storage.removeSubmission).toHaveBeenCalledWith('100');
    expect(storage.addToQueue).toHaveBeenCalledWith('200');
  });
  
  it('should not duplicate same submission ID', async () => {
    vi.mocked(storage.getSettings).mockResolvedValue({
      commitQueue: ['100'],
    });
    
    await queue.enqueue('100', { id: '100', problem: { titleSlug: 'two-sum' } });
    
    expect(storage.addToQueue).not.toHaveBeenCalled();
  });
});
```

### Pattern 3: Testing File Extension Mapping

```typescript
// src/queue/__tests__/fileExtension.test.ts
import { describe, it, expect } from 'vitest';
import { getFileExtension } from '../paths';

describe('getFileExtension', () => {
  const cases: Array<[string, string]> = [
    ['java', 'java'],
    ['Java', 'java'],
    ['python3', 'py'],
    ['Python', 'py'],
    ['c++', 'cpp'],
    ['C++', 'cpp'],
    ['javascript', 'js'],
    ['typescript', 'ts'],
    ['golang', 'go'],
    ['rust', 'rs'],
    ['c#', 'cs'],
    ['unknown-lang', 'txt'],
  ];
  
  it.each(cases)('maps "%s" to ".%s"', (input, expected) => {
    expect(getFileExtension(input)).toBe(expected);
  });
});
```

### Pattern 4: Testing README Generation

```typescript
// src/readme/__tests__/readme.test.ts
import { describe, it, expect } from 'vitest';
import { generateRootReadme } from '../index';

describe('generateRootReadme', () => {
  it('should generate correct stats table', () => {
    const problems = [
      { id: '1', title: 'Two Sum', difficulty: 'Easy', language: 'Java', folder: 'Easy/two-sum', ext: 'java' },
      { id: '2', title: 'Add Two Numbers', difficulty: 'Medium', language: 'Python', folder: 'Medium/add-two-numbers', ext: 'py' },
    ];
    
    const readme = generateRootReadme(problems);
    
    expect(readme).toContain('| 2 | 1 | 1 | 0 |'); // Total, Easy, Medium, Hard
    expect(readme).toContain('[Two Sum]');
    expect(readme).toContain('[Add Two Numbers]');
  });
  
  it('should handle empty problem list', () => {
    const readme = generateRootReadme([]);
    expect(readme).toContain('| 0 | 0 | 0 | 0 |');
  });
});
```

---

## Configuration

### Vitest Config for Chrome Extension

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__mocks__/chrome.ts'],
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/__mocks__/**'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
```

---

## Checklists

### Unit Test Checklist

- [ ] Chrome APIs mocked before tests run
- [ ] Mock storage reset between tests (`beforeEach`)
- [ ] All public functions have at least 1 test
- [ ] Edge cases tested (null, undefined, empty array, empty string)
- [ ] Async operations awaited properly
- [ ] Tests are isolated (no shared mutable state)
- [ ] Test names describe expected behavior
- [ ] Coverage thresholds set in vitest.config.ts

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Chrome Extensions](https://developer.chrome.com/docs/extensions/develop/concepts/testing)

---
name: error-handling
description: GitHub API error handling patterns, error classification, recovery strategies, and user-facing error messages for CodeSync.
---

# GitHub Error Handling — Classification, Recovery & User Messaging

## Purpose & Scope

Use this skill when handling GitHub API errors, classifying error types, implementing recovery strategies, and presenting errors to users.

---

## Error Classification

| HTTP Status | Meaning | Retryable | Recovery |
|------------|---------|-----------|----------|
| 200-299 | Success | N/A | N/A |
| 401 | Unauthorized | No | Re-authenticate (token expired/revoked) |
| 403 | Forbidden | Maybe | Check rate limits; check token scopes |
| 404 | Not Found | No | Verify repo exists and token has access |
| 409 | Conflict | Yes | Fetch fresh branch SHA, retry |
| 422 | Validation Failed | No | Fix request payload (bad tree, invalid path) |
| 429 | Rate Limited | Yes | Exponential backoff |
| 500-503 | Server Error | Yes | Retry with backoff |

---

## Implementation Patterns

### Pattern 1: Typed Error Classes

```typescript
export class GitHubAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly apiMessage: string,
    public readonly endpoint: string
  ) {
    super(`GitHub API ${status} at ${endpoint}: ${apiMessage}`);
    this.name = 'GitHubAPIError';
  }
  
  get isRetryable(): boolean {
    return [409, 429, 500, 502, 503].includes(this.status);
  }
  
  get isAuthError(): boolean {
    return this.status === 401;
  }
  
  get isRateLimit(): boolean {
    return this.status === 403 || this.status === 429;
  }
  
  get userMessage(): string {
    switch (this.status) {
      case 401: return 'GitHub authentication expired. Please re-login.';
      case 403: return 'Access denied. Check your token permissions.';
      case 404: return 'Repository not found. Check your settings.';
      case 409: return 'Sync conflict detected. Retrying...';
      case 429: return 'Too many requests. Will retry shortly.';
      default: return `GitHub error (${this.status}). Please try again.`;
    }
  }
}
```

### Pattern 2: Error Recovery Router

```typescript
async function handleSyncError(error: unknown, submission: SubmissionData): Promise<void> {
  if (error instanceof GitHubAPIError) {
    if (error.isAuthError) {
      notifyUser('error', error.userMessage);
      await storage.updateSettings({ githubToken: '' }); // Clear bad token
      return;
    }
    
    if (error.isRetryable) {
      console.log('[CodeSync] Retryable error, will process on next alarm');
      // Leave in queue for next alarm cycle
      return;
    }
    
    // Non-retryable — remove from queue and notify
    await queue.removeFromQueue(submission.id);
    notifyUser('error', error.userMessage);
    return;
  }
  
  // Network error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    console.warn('[CodeSync] Network error — will retry on next alarm');
    return; // Leave in queue
  }
  
  // Unknown error
  console.error('[CodeSync] Unexpected error:', error);
  notifyUser('error', 'An unexpected error occurred during sync.');
}
```

---

## Checklists

- [ ] All fetch calls wrapped in try-catch
- [ ] HTTP status codes mapped to typed errors
- [ ] Retryable vs non-retryable errors distinguished
- [ ] User-facing messages are clear and actionable
- [ ] Auth errors trigger re-login flow
- [ ] Network errors leave items in queue for retry
- [ ] Error details logged with [CodeSync] prefix
- [ ] Non-retryable errors remove item from queue

---

## References

- [GitHub API Error Responses](https://docs.github.com/en/rest/overview/troubleshooting)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

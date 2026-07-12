---
name: rate-limiting
description: GitHub API rate limiting strategies, exponential backoff, quota monitoring, and request batching for CodeSync.
---

# GitHub Rate Limiting — Strategies & Recovery

## Purpose & Scope

Use this skill when handling GitHub API rate limits, implementing retry strategies, or optimizing API call patterns.

---

## Architecture & Concepts

### GitHub Rate Limits

| Auth Type | Rate Limit | Window | Header |
|-----------|-----------|--------|--------|
| Authenticated (token) | 5,000 req/hour | Rolling | `X-RateLimit-Remaining` |
| Unauthenticated | 60 req/hour | Rolling | `X-RateLimit-Remaining` |
| Search API | 30 req/min | Rolling | `X-RateLimit-Remaining` |

### CodeSync API Calls Per Sync

| Operation | API Calls | Endpoint |
|-----------|-----------|----------|
| Get branch SHA | 1 | GET /git/refs |
| Get commit tree | 1 | GET /git/commits |
| Create blobs | N files | POST /git/blobs |
| Create tree | 1 | POST /git/trees |
| Create commit | 1 | POST /git/commits |
| Update ref | 1 | PATCH /git/refs |
| **Total per sync** | **N + 4** | |

For a typical sync (3 files: solution + problem README + root README): **7 API calls**

---

## Implementation Patterns

### Pattern 1: Rate-Limit-Aware Fetch Wrapper

```typescript
class RateLimitedFetch {
  private remaining = 5000;
  private resetAt = 0;
  
  async fetch(url: string, options: RequestInit): Promise<Response> {
    // Check if we're rate limited
    if (this.remaining <= 10 && Date.now() < this.resetAt) {
      const waitMs = this.resetAt - Date.now();
      console.warn(`[CodeSync] Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s`);
      await this.sleep(waitMs);
    }
    
    const response = await fetch(url, options);
    
    // Update rate limit info
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    
    if (remaining) this.remaining = parseInt(remaining);
    if (reset) this.resetAt = parseInt(reset) * 1000;
    
    // Handle 403 rate limit response
    if (response.status === 403 && this.remaining === 0) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
      
      console.warn(`[CodeSync] Rate limited (403). Retrying in ${waitMs / 1000}s`);
      await this.sleep(waitMs);
      
      return this.fetch(url, options); // Retry
    }
    
    return response;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Pattern 2: Exponential Backoff with Jitter

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429 || (response.status === 403 && 
          response.headers.get('X-RateLimit-Remaining') === '0')) {
        if (attempt === maxRetries) throw new Error('Rate limit exceeded');
        
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 1000;
        await new Promise(r => setTimeout(r, baseDelay + jitter));
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new Error('Unreachable');
}
```

---

## Checklists

- [ ] Rate limit headers parsed on every response
- [ ] Exponential backoff with jitter on 429/403
- [ ] Remaining quota logged for debugging
- [ ] Batch API calls where possible (Trees API)
- [ ] User notified when rate limited
- [ ] Don't retry on 401/404 (not transient)

---

## References

- [GitHub Rate Limiting](https://docs.github.com/en/rest/rate-limit)
- [Best Practices for API Integrators](https://docs.github.com/en/rest/guides/best-practices-for-integrators)

---
name: graphql-interceptor
description: LeetCode GraphQL API interception, query/mutation patterns, response parsing, and schema analysis for CodeSync.
---

# GraphQL Interceptor — LeetCode API Analysis & Interception

## Purpose & Scope

Use this skill when analyzing LeetCode's GraphQL schema, intercepting specific queries/mutations, or extending the interceptor for new API patterns.

---

## LeetCode GraphQL Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `leetcode.com/graphql/` | POST | Cookie | Main API |
| `leetcode.com/graphql` | POST | Cookie | Same (no trailing slash) |

### Key Queries/Mutations

```graphql
# Submit a solution
mutation submit($input: SubmitInput!) {
  submit(input: $input) { submissionId }
}

# Check submission status (polling)
query submissionProgress($submissionId: Int!) {
  submissionProgress(submissionId: $submissionId) {
    statusCode state
  }
}

# Get full submission details
query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    code statusCode runtime memory
    lang { name }
    question { title titleSlug difficulty }
    timestamp
  }
}

# Get problem details
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title difficulty content topicTags { name }
  }
}
```

---

## Implementation Patterns

### Pattern 1: Operation-Aware Interceptor

```typescript
function inspectGraphQLRequest(url: string, requestBody: string): void {
  try {
    const parsed = JSON.parse(requestBody);
    const operationName = parsed.operationName || 'unknown';
    
    // Only track submission-related operations
    const TRACKED_OPS = ['submit', 'submissionProgress', 'submissionDetails', 'checkSubmission'];
    
    if (TRACKED_OPS.includes(operationName)) {
      console.log(`[CodeSync] Tracked GraphQL operation: ${operationName}`);
    }
  } catch {
    // Not JSON — ignore
  }
}
```

### Pattern 2: Response Body Extraction

```typescript
// Both fetch and XHR interceptors need to extract response bodies safely

// For fetch: use response.clone().json()
// For XHR: use this.responseText after 'load' event

// Key safety rules:
// 1. Always clone() fetch responses
// 2. Always try-catch JSON.parse
// 3. Never modify the original response
// 4. Only process /graphql URLs
```

---

## References

- [GraphQL Specification](https://spec.graphql.org/)
- [LeetCode API Analysis](https://leetcode.com/graphql/)

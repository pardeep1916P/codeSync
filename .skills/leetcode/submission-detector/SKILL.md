---
name: submission-detector
description: LeetCode submission detection via GraphQL network interception, status code parsing, and multi-pattern matching for CodeSync.
---

# Submission Detector — LeetCode Accepted Solution Detection

## Purpose & Scope

Use this skill when implementing or debugging the LeetCode submission detection system that captures accepted solutions.

---

## Architecture & Concepts

### LeetCode Submission Flow

```
User submits solution
        ↓
LeetCode frontend sends GraphQL mutation
        ↓
Server judges solution (may take seconds)
        ↓
Frontend polls for result via GraphQL
        ↓
Response contains statusCode: 10 (Accepted)
        ↓
CodeSync interceptor detects this
        ↓
Content script fetches full submission details
        ↓
Submission sent to background for queuing
```

### LeetCode Status Codes

| Code | Status | Action |
|------|--------|--------|
| 10 | Accepted | ✅ Capture submission |
| 11 | Wrong Answer | ❌ Ignore |
| 12 | Memory Limit | ❌ Ignore |
| 13 | Output Limit | ❌ Ignore |
| 14 | Time Limit | ❌ Ignore |
| 15 | Runtime Error | ❌ Ignore |
| 16 | Compile Error | ❌ Ignore |
| 20 | Pending | ⏳ Wait for final status |

### GraphQL Response Patterns

LeetCode uses multiple GraphQL query patterns that may contain submission results:

```typescript
// Pattern 1: submissionDetails query
json.data.submissionDetails.statusCode === 10

// Pattern 2: submit mutation response
json.data.submit.statusCode === 10

// Pattern 3: submissionProgress polling
json.data.submissionProgress.statusCode === 10

// Pattern 4: checkSubmission polling (older API)
json.data.checkSubmission.statusCode === 10
```

---

## Implementation Patterns

### Pattern 1: Multi-Pattern Submission Checker

```typescript
function checkForAcceptedSubmission(json: any): {
  found: boolean;
  submissionId?: string;
  source?: string;
} {
  // Pattern 1: submissionDetails
  if (json?.data?.submissionDetails?.statusCode === 10) {
    return {
      found: true,
      submissionId: String(json.data.submissionDetails.id || ''),
      source: 'submissionDetails',
    };
  }
  
  // Pattern 2: submit
  if (json?.data?.submit?.statusCode === 10) {
    return {
      found: true,
      submissionId: String(json.data.submit.submissionId || json.data.submit.id || ''),
      source: 'submit',
    };
  }
  
  // Pattern 3: submissionProgress
  if (json?.data?.submissionProgress?.statusCode === 10) {
    return {
      found: true,
      submissionId: String(json.data.submissionProgress.submissionId || ''),
      source: 'submissionProgress',
    };
  }
  
  // Pattern 4: checkSubmission
  if (json?.data?.checkSubmission?.statusCode === 10) {
    return {
      found: true,
      submissionId: String(json.data.checkSubmission.submissionId || ''),
      source: 'checkSubmission',
    };
  }
  
  return { found: false };
}
```

### Pattern 2: Submission Details Fetcher

```typescript
const SUBMISSION_DETAILS_QUERY = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      runtime
      runtimePercentile
      memory
      memoryPercentile
      code
      statusCode
      lang { name verboseName }
      question {
        title
        titleSlug
        difficulty
        questionId
        categoryTitle
        topicTags { name slug }
      }
      timestamp
      notes
    }
  }
`;

async function fetchSubmissionDetails(
  submissionId: string
): Promise<SubmissionDetails | null> {
  try {
    const response = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': window.location.href,
      },
      body: JSON.stringify({
        query: SUBMISSION_DETAILS_QUERY,
        variables: { submissionId: parseInt(submissionId, 10) },
      }),
    });
    
    if (!response.ok) return null;
    
    const json = await response.json();
    const details = json?.data?.submissionDetails;
    
    if (!details || details.statusCode !== 10) return null;
    
    return details;
  } catch (error) {
    console.error('[CodeSync] Failed to fetch submission details:', error);
    return null;
  }
}
```

### Pattern 3: Deduplication at Detection Level

```typescript
// Prevent the same submission from being processed twice
const processedSubmissions = new Set<string>();
const DEDUP_WINDOW = 30_000; // 30 seconds

function shouldProcess(submissionId: string): boolean {
  if (processedSubmissions.has(submissionId)) {
    return false;
  }
  
  processedSubmissions.add(submissionId);
  
  // Clean up after window
  setTimeout(() => {
    processedSubmissions.delete(submissionId);
  }, DEDUP_WINDOW);
  
  return true;
}
```

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| Submissions not detected | GraphQL response pattern changed | Add new pattern to checker |
| Duplicate detections | Both fetch and XHR catch same response | Use deduplication Set |
| Submission details empty | LeetCode auth cookie not sent | Use same origin fetch from content script |
| Wrong submission captured | Checking wrong statusCode | Verify statusCode === 10 only |
| Detection works but queue doesn't update | Message not reaching background | Check chrome.runtime.sendMessage |

---

## References

- [LeetCode GraphQL API (unofficial)](https://github.com/aylei/leetcode-rust)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

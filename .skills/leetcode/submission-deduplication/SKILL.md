---
name: submission-deduplication
description: Queue deduplication strategies for handling duplicate submissions of the same LeetCode problem in CodeSync.
---

# Submission Deduplication — Same-Problem Queue Management

## Purpose & Scope

Use this skill when implementing or debugging the deduplication logic that ensures only the latest submission for each problem is kept in the queue.

---

## Architecture & Concepts

### Deduplication Layers

```
Layer 1: Content Script (detection-level)
  → Set of seen submission IDs with 30s TTL
  → Prevents same submission ID from being sent twice

Layer 2: Queue Manager (enqueue-level)
  → Check if same problem slug exists in queue
  → If yes: remove old entry, clean up cached data, add new entry
  → Serialized via Promise chain to prevent races

Layer 3: Storage (persistence-level)
  → sub_{id} entries cleaned when removed from queue
```

---

## Implementation Patterns

### Pattern 1: Promise-Chained Enqueue with Deduplication

```typescript
class CommitQueue {
  private enqueueChain = Promise.resolve();
  
  async enqueue(submissionId: string, data: SubmissionData): Promise<void> {
    this.enqueueChain = this.enqueueChain.then(async () => {
      const settings = await storage.getSettings();
      const queue = settings.commitQueue;
      
      // Check for existing entry with same problem slug
      for (const existingId of queue) {
        if (existingId === submissionId) return; // Same exact submission
        
        const existingData = await storage.getSubmission(existingId);
        if (existingData?.problem.titleSlug === data.problem.titleSlug) {
          // Same problem, different submission — replace old with new
          console.log(`[CodeSync] Replacing old submission ${existingId} with ${submissionId}`);
          
          await storage.removeSubmission(existingId);
          await this.removeIdFromQueue(existingId);
          break;
        }
      }
      
      // Add new submission
      await storage.saveSubmission(submissionId, data);
      await storage.addToQueue(submissionId);
      
      const updated = await storage.getSettings();
      this.notifyQueueUpdated(updated.commitQueue.length, data.problem.title);
    });
    
    return this.enqueueChain;
  }
}
```

### Pattern 2: Why Promise Chaining

```
Without chaining (race condition):
  T0: Read queue → [A]
  T1: Read queue → [A]          (concurrent read before T0 writes)
  T0: Write queue → [A, B]
  T1: Write queue → [A, C]     (overwrites B!)

With chaining (serialized):
  T0: Read queue → [A]
  T0: Write queue → [A, B]
  T1: Read queue → [A, B]      (waits for T0 to finish)
  T1: Write queue → [A, B, C]  (correct!)
```

---

## Checklists

- [ ] Same submission ID not enqueued twice
- [ ] Same problem slug replaces older entry
- [ ] Old submission cache data cleaned on replacement
- [ ] Enqueue operations serialized (no race conditions)
- [ ] Queue length notification sent after update
- [ ] Dedup window at content script level prevents rapid-fire

---

## References

- [Promise Chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then)

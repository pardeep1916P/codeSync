---
name: codesync-queue-and-sync
description: Managing the CommitQueue state machine, deduplication, directory templating, atomic Git tree batching, and in-repo codesync_state persistence.
---

# CodeSync Queue, Deduplication & Synchronization Guide

Use this skill when modifying the submission queue, storage serialization, directory layout generation, or GitHub commit preparation in `src/queue/` and `src/readme/`.

---

## 1. Queue Architecture & State Machine

The `CommitQueue` class (`src/queue/index.ts`) manages incoming submissions asynchronously. To prevent race conditions from concurrent judge completions, all enqueue operations are chained onto a sequential Promise queue (`enqueuePromise`):

```typescript
export class CommitQueue {
  private isProcessing = false;
  private enqueuePromise: Promise<void> = Promise.resolve();

  async enqueue(submission: Submission): Promise<void> {
    this.enqueuePromise = this.enqueuePromise.then(() => this.enqueueInternal(submission));
    return this.enqueuePromise;
  }
}
```

---

## 2. Deduplication Invariant

Before appending a submission to the queue, `CommitQueue` performs two checks:
1. **Submission ID Deduplication**: If `submission.id` is already in `settings.commitQueue`, skip.
2. **Problem Slug & Language Deduplication**: If a prior submission exists for the same problem slug and the same programming language:
   - Remove the old submission ID from `commitQueue`.
   - Remove the old temporary storage key `sub_${oldId}` from `chrome.storage.local`.
   - Insert the new submission ID.

This guarantees that re-solving a problem updates existing pending files rather than creating duplicate commits or conflicting files.

---

## 3. Configurable Repository Layouts

CodeSync supports 3 user-configurable directory hierarchies defined in `src/storage/index.ts`:

```typescript
export type FolderLayout = 'difficulty' | 'platform' | 'flat';
```

### Path Generation Rules (`src/queue/index.ts`)
```typescript
function getFolderPath(
  layout: FolderLayout,
  platform: string,
  difficulty: string,
  slug: string
): string {
  switch (layout) {
    case 'difficulty':
      // Default: e.g. leetcode/Easy/two-sum/
      return `${platform}/${difficulty}/${slug}`;
    case 'platform':
      // e.g. leetcode/two-sum/
      return `${platform}/${slug}`;
    case 'flat':
      // e.g. two-sum/
      return slug;
    default:
      return `${platform}/${difficulty}/${slug}`;
  }
}
```

Files committed under each problem directory:
- Solution source file: `{folderPath}/solution.{ext}`
- Solution README: `{folderPath}/README.md`

---

## 4. In-Repository Preference Synchronization (`codesync_state`)

To allow users to switch laptops or browsers (Chrome $\leftrightarrow$ Edge) without resetting preferences or creating folder collisions, CodeSync stores an opaque, base64-encoded state string inside `stats.json` in the root of the user's repository:

```json
{
  "solved": 42,
  "codesync_state": "cs:eyJsYXlvdXQiOiJkaWZmaWN1bHR5Iiwic3luY09uQWNjZXB0Ijp0cnVlLCJzeW5jSGlzdG9yaWNhbE9uVmlldyI6ZmFsc2UsImRlc2t0b3BOb3RpZmljYXRpb25zIjpmYWxzZSwidGhlbWUiOiJkcmFjdWxhIn0=",
  "shas": {}
}
```

### Encapsulated Settings
1. `layout`: Directory structure preference (`difficulty` | `platform` | `flat`)
2. `syncOnAccept`: Immediate background sync toggle (`true` | `false`)
3. `syncHistoricalOnView`: Historical submissions sync toggle (`true` | `false`)
4. `desktopNotifications`: OS notifications toggle (`true` | `false`)
5. `theme`: Selected UI theme identifier (`amoled`, `dracula`, `tokyo_night`, etc.)

When a repository is selected in `src/store/index.ts`, `parseRepoCodesyncState()` automatically decodes this payload and synchronizes local extension storage.

---

## 5. README & Problems Table Indexing

The root `README.md` of the target GitHub repository contains an automatically updated Markdown index table of all solved problems.

### Key Rules (`src/queue/readmeTable.ts`):
- Pure string parsing: Never parse entire Markdown with heavy external libraries.
- Header anchor markers: Detect `## Solved Problems` or table delimiters (`| Problem | Difficulty | Language | Solution | Date |`).
- Deduplication: If the problem slug already exists in the table, update the existing row with the latest solve timestamp and solution link.
- Chronological or ID ordering: Consistent formatting across all platforms.

---

## 6. Commit Processing Flow

When `processQueue()` executes:
1. Acquire execution lock: Set `codesync_is_syncing: true` in storage.
2. Load all pending submissions in a single batched `chrome.storage.local.get()` call.
3. Sort pending submissions chronologically (oldest to newest) to preserve authentic progression.
4. Prepare Git Tree payload:
   - Solution code blob
   - Problem description `README.md`
   - Updated root `README.md` table
   - Updated `stats.json` (with updated `solved` count and `codesync_state`)
5. Execute atomic commit via `GitHubClient.commitTree()`.
6. Clear processed submission IDs and `sub_<id>` keys from storage.
7. Release execution lock: Set `codesync_is_syncing: false`.

---

## 7. Testing & Verification

Unit tests for queue deduplication and table formatting are located in `src/queue/__tests__/`:
```bash
npm run test -- src/queue/__tests__/readmeTable.test.ts
npm run test -- src/queue/__tests__/fileExtension.test.ts
```

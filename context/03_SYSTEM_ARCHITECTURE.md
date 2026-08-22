# System Architecture
 
CodeSync is organized into decoupled domain layers with a modular UI architecture:

```mermaid
flowchart TD
    subgraph UI ["Modular Popup UI (src/popup/components)"]
        HB[Header.tsx]
        UB[UpdateBanner.tsx]
        RC[RepoSelector.tsx]
        SC[SyncControl.tsx]
        AF[AuthForm.tsx]
        FT[Footer.tsx]
    end

    subgraph Store ["Reactive State (src/store)"]
        ZS[Zustand Store]
    end

    subgraph Background ["Service Worker (src/background)"]
        SW[Background Worker]
        UC[chrome.runtime.requestUpdateCheck]
        UA[chrome.runtime.onUpdateAvailable]
        RL[chrome.runtime.reload]
    end

    subgraph Domain ["Core Domain Logic"]
        CQ[CommitQueue / src/queue]
        GH[GitHubClient / src/github]
        RD[ReadmeGenerator / src/readme]
        PL[Platform Adapters / src/platforms]
        PS[LeetCodeParser / src/parser]
        LRU[LRUCache / src/utils/lru]
    end

    HB & UB & RC & SC & AF & FT --> ZS
    ZS --> SW
    SW --> UC & UA & RL
    SW --> CQ
    CQ --> GH & RD & PL & PS
```

### Module Responsibilities:
- **`src/content/interceptor.ts`**: Native Manifest V3 MAIN-world interceptor for monkey-patching `window.fetch`/`XMLHttpRequest` at `document_start`.
- **`src/content/index.ts`**: ISOLATED-world content script bridging intercepted data to service worker, with in-memory LRU question metadata caching.
- **`src/platforms/`**: Extensible multi-platform adapter registry supporting LeetCode, Codeforces, HackerRank, and GeeksforGeeks.
- **`src/parser/`**: Pure functions for extracting and normalizing problem descriptions and metadata.
- **`src/queue/`**: Deduplication state machine for FIFO queue persistence, directory template resolution, and bulk atomic Git Tree commit batching.
- **`src/github/`**: Batched GraphQL & Git Trees client with explicit `author.date` and `committer.date` timestamp preservation.
- **`src/readme/`**: Decoupled Markdown and HTML table generator for solutions and README indexes.
- **`src/utils/lru.ts`**: High-performance bounded O(1) LRU cache to eliminate memory leaks and garbage collection churn.
- **`src/storage/`**: Typed wrapper over `chrome.storage.local` with AES-GCM token encryption.
- **`src/store/`**: Reactive Zustand state caching.
- **`src/popup/components/`**: Modular, single-responsibility UI blocks.


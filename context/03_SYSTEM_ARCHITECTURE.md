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
        PS[LeetCodeParser / src/parser]
    end

    HB & UB & RC & SC & AF & FT --> ZS
    ZS --> SW
    SW --> UC & UA & RL
    SW --> CQ
    CQ --> GH & RD & PS
```

### Module Responsibilities:
- **`src/content/`**: Intercepts LeetCode network submissions and bridges payload data to background worker.
- **`src/parser/`**: Pure functions for extracting and normalizing problem descriptions and metadata.
- **`src/queue/`**: Deduplication state machine for FIFO queue persistence and bulk atomic Git Tree commit batching.
- **`src/github/`**: Batched GraphQL & Git Trees client for ultra-fast, sub-second atomic multi-file commits.
- **`src/readme/`**: Decoupled Markdown and HTML table generator for solutions and README indexes.
- **`src/storage/`**: Typed wrapper over `chrome.storage.local`.
- **`src/store/`**: Reactive Zustand state caching.
- **`src/popup/components/`**: Modular, single-responsibility UI blocks.


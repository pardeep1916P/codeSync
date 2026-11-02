# CodeSync — Agent Rules & Engineering Standards

Welcome to **CodeSync** (`codesync@1.2.1`). This document is the authoritative project constitution for AI coding agents and human engineers. It establishes architectural invariants, technology stack boundaries, coding standards, and development workflows.

---

## 1. Project Overview & Architecture

CodeSync is a Manifest V3 browser extension that automatically captures and syncs accepted coding problem submissions from competitive programming platforms (LeetCode, Codeforces, HackerRank, GeeksforGeeks, CodeChef) to personal GitHub repositories in real time.

### Core Architectural Flow
```
[MAIN World Page]                 [ISOLATED Content Script]          [Background Service Worker]              [GitHub REST API]
interceptor.ts (fetch/XHR)  --->  content/index.ts (LRU Cache)  --->  queue/index.ts (CommitQueue)  --->  Git Trees API (/git/trees)
(status_code: 10 detection)       (postMessage Bridge)               (Deduplication & Storage)             (Authentic Commit Timestamps)
```

---

## 2. Technology Stack & Hard Constraints

| Layer | Approved Technologies | Prohibited Technologies |
| :--- | :--- | :--- |
| **Extension Platform** | Chrome Extension Manifest V3 (MV3) | Manifest V2, background persistent pages |
| **UI Framework** | **React 18** (Functional components, hooks) | Vue.js, Angular, Svelte, class components |
| **Styling** | **Tailwind CSS**, Radix UI primitives | Bootstrap, styled-components, CSS-in-JS, inline styles |
| **State Management** | **Zustand** (with cross-context messaging) | Redux, MobX, Context API wrappers |
| **Language & Typings** | **TypeScript 5.x** (Strict Mode) | Plain JavaScript, untyped `any` without lint exceptions |
| **Cryptography** | Web Crypto API (`crypto.subtle`) AES-GCM (256-bit) | Node `crypto` polyfills, plain text token storage |
| **Bundling** | **Vite 8**, PostCSS, Autoprefixer | Webpack, Rollup manual configs |
| **Testing** | **Vitest 4** | Jest, Mocha, Chai |
| **Specification** | **OpenSpec** (`openspec/`) | Ad-hoc unversioned spec documents |

> [!CAUTION]
> **No Vue or Alternative Frameworks**:
> CodeSync is strictly a React 18 and TypeScript application. Never generate Vue Options API, Vue Composition API, `<template>`, or Angular code.

---

## 3. Seven Inviolable Domain Invariants

Whenever proposing, generating, or modifying code in this repository, you **MUST** uphold all seven invariants:

1. **Never Break Public Interfaces**:
   - Maintain backward compatibility for `PlatformAdapter` (`src/platforms/types.ts`) and storage schemas (`UserSettings` in `src/storage/index.ts`).
2. **Every Platform Must Implement `PlatformAdapter`**:
   - All competitive programming platforms must implement the `PlatformAdapter` contract, provide difficulty normalization, language extension mapping, and register in `src/platforms/registry.ts`.
3. **All Uploads Must Route Through `CommitQueue`**:
   - Never bypass `CommitQueue` (`src/queue/index.ts`) to commit directly from content scripts or popup components.
4. **Exactly One Commit Per Accepted Submission**:
   - Submissions must be deduplicated by problem slug and language. Never create redundant duplicate commits for re-solves.
5. **Decoupled Architecture Layers**:
   - Keep GitHub REST/GraphQL logic (`src/github/`) completely isolated from platform parsers (`src/parser/`, `src/platforms/`) and UI components (`src/popup/`, `src/options/`).
6. **Zero Console Noise in Production**:
   - Production builds automatically strip `console.log` via Vite `esbuild.drop`. Diagnostic logs must use `logToBackground` (`src/utils/logger.ts`) and `action: 'LOG'` messaging. Never circumvent build-time log stripping.
7. **Authentic Historical Timestamps**:
   - For all commits (live or historical), both `author.date` and `committer.date` MUST be explicitly set to the ISO 8601 timestamp (`new Date(submission.timestamp).toISOString()`) to accurately reflect on the user's GitHub contribution graph.

---

## 4. Key Development Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Launch Vite watch mode for development (full debug logs enabled in Chrome). |
| `npm run build:dev` | Compile TypeScript and build extension with diagnostic logs enabled. |
| `npm run build` | Compile TypeScript and generate clean, minified production build (logs stripped). |
| `npm run lint` | Run ESLint checks across TypeScript source files. |
| `npm run test` | Run Vitest unit tests across parsers, queue, storage, and platform adapters. |
| `npm run preview` | Preview Vite build. |
| `npx openspec` | Run OpenSpec CLI to validate or manage spec-driven changes. |

---

## 5. Repository Layout & Module Ownership

```
codeSync/
├── .agent/              # Canonical agent configuration, skills, and workflows
│   ├── skills/          # Domain skills + OpenSpec skills
│   └── workflows/       # OpenSpec workflow definitions (opsx-*.md)
├── context/             # Architectural vision, phases, and historical audit context
├── openspec/            # OpenSpec spec-driven development schemas and specs
│   ├── config.yaml      # OpenSpec configuration
│   └── specs/           # System capability specs (core-sync, auth, dashboard, etc.)
├── public/              # Static assets, icons, manifest.json
└── src/                 # Application source code
    ├── background/      # MV3 Service Worker (alarms, queue triggers, update checks)
    ├── components/      # Shared React UI components (Button, Modal, Radix Switch)
    ├── content/         # Content scripts (interceptor in MAIN world, bridge in ISOLATED)
    ├── github/          # GitHub API client, Git Trees API, OAuth proxy client
    ├── options/         # Options page React application
    ├── parser/          # Pure functions for problem description normalization
    ├── platforms/       # Modular platform adapters (LeetCode, Codeforces, HackerRank, etc.)
    ├── popup/           # Popup UI React application and components
    ├── queue/           # CommitQueue state machine and README table generator
    ├── readme/          # Markdown problem solution template generator
    ├── storage/         # Typed chrome.storage wrapper with AES-GCM token encryption
    ├── store/           # Zustand reactive state store with cross-context sync
    ├── styles/          # Tailwind styles, 15+ CSS theme definitions
    └── utils/           # Web Crypto, HTML sanitizer, LRU cache, logger, languages
```

---

## 6. Available Domain Skills

When working on CodeSync, leverage the domain-specific skills in `.agent/skills/`:
- **`codesync-platform-adapter`**: Adding or modifying competitive programming platform adapters.
- **`codesync-network-interception`**: Debugging or updating MAIN-world fetch/XHR interceptors and content script bridges.
- **`codesync-queue-and-sync`**: Maintaining `CommitQueue`, deduplication, directory templating, and `codesync_state` serialization.
- **`codesync-github-integration`**: Working with Git Data Trees API, batched GraphQL sync, authentic timestamps, and OAuth proxy.
- **`codesync-storage-and-security`**: Managing AES-GCM encryption, Chrome storage settings, and extension CSP rules.
- **`codesync-ui-and-state`**: Updating Zustand stores, cross-context messaging, 15+ CSS themes, and React UI components.
- **`codesync-extension-ops-and-release`**: Vite build configurations, service worker alarms, CI/CD pipeline, and Web Store deployment.
- **`openspec-*`**: Spec-driven development workflows (`propose`, `explore`, `apply`, `sync`, `archive`).

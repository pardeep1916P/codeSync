# CodeSync

CodeSync is a modern, lightweight, and gorgeous browser extension that automatically captures your accepted LeetCode submissions and synchronizes them directly to your personal GitHub repository. Built with React, TypeScript, Zustand, and Vite, it features a state-of-the-art terminal-inspired UI with full custom theme support.

---

## 🚀 Key Features

* **Bulletproof Submission Capture**: Replaced fragile DOM scraping with advanced **network request interception (Fetch/XHR monkeypatching)** to detect accepted GraphQL payloads instantly, making it highly resilient to LeetCode interface updates.
* **Instant Sync Toggle**: Turn on "Instant sync on Acceptance" to push your code the second LeetCode accepts your solution, or turn it off to hold submissions in a local queue.
* **Reactive Activation Trigger**: Toggling Auto-Sync to ON immediately triggers processing of any existing queued items.
* **Smart Pending Queue**: Manage pending uploads from a beautiful card dashboard. Support for deleting individual items or clearing the entire queue at once.
* **Automatic Deduplication**: Submitting the same problem multiple times? CodeSync automatically chains submissions sequentially and replaces older queue entries with the latest accepted code.
* **Multi-Theme Engine**: Beside the Settings gear icon, switch between 15+ curated themes (AMOLED, Catppuccin, Tokyo Night, Dracula, Cyberpunk, Matrix, Nord, and more). AMOLED is the default.
* **Fast Caching**: Implemented a two-phase initialization protocol (instant storage-backed rendering + silent background GitHub synchronization) to completely eliminate reload flashes.
* **Desktop & Toast Notifications**: Real-time notifications pop up in your browser and on your desktop to confirm successful commits or explain failures.
* **Zero Console Footprint**: Optimized for production environments by removing all console logs, warnings, and error prints during runtime.

---

## 🛠️ Installation & Setup

1. **Clone & Build the Extension**:
   ```bash
   git clone https://github.com/pardeep1916P/codeSync.git
   cd codeSync
   npm install
   npm run build
   ```
2. **Load into Google Chrome**:
   * Open Google Chrome and navigate to `chrome://extensions/`.
   * Enable **Developer mode** in the top right corner.
   * Click **Load unpacked** in the top left corner.
   * Select the `dist/` directory generated in the project root folder.
3. **Configure Settings**:
   * Click the **CodeSync** icon in your extension tray.
   * Enter your GitHub Personal Access Token (with `repo` permissions) or log in using OAuth.
   * Select your target repository from the dropdown, configure your sync toggle, and start coding on LeetCode!

---

## 💻 Development Commands

* **`npm run dev`** — Launch Vite development server.
* **`npm run build`** — Compile TypeScript and build production bundle using Vite.
* **`npm run lint`** — Run ESLint checks across source tree.
* **`npm run test`** — Execute unit tests using Vitest.

---

## 🤖 CI/CD Release Pipeline

We use **GitHub Actions** to automate our code verification and release packaging:
- **Build and Test Validation**: Every push to the `main` branch triggers a workflow that installs dependencies, runs the ESLint linter, runs unit tests, and verifies that the production build compiles cleanly.
- **Smart Path Filtering**: The workflow is configured with `paths-ignore` to prevent redundant runner triggers if the only modified files are non-code assets, such as:
  - Agent instruction skills (`.skills/**`)
  - Project specification logs (`context/**`)
  - Repository documentation (`README.md`, `LICENSE`)
- **Automated Releases**: When a new release is published, the workflow automatically compiles the extension and attaches the ready-to-load extension archive (`codesync-extension.zip`) directly to the release page as a download asset.

---

## 📂 Project Structure

```
├── .github/
│   └── workflows/         # GitHub Actions CI/CD workflows
├── public/                # Extension icons and Manifest configuration
├── src/
│   ├── background/        # Service worker managing queue alarms and events
│   ├── content/           # Main-world fetch/XHR network interceptor & isolated bridge
│   ├── github/            # Git Trees API client and OAuth integrations
│   ├── queue/             # Submission commit queue logic and README updates
│   ├── store/             # Global state managed via Zustand (storage caching)
│   ├── styles/            # Core CSS theme tokens and global styles
│   └── popup/             # Main Dashboard React user interface
├── README.md              # Repository documentation
└── vite.config.ts         # Vite build configuration
```

---

## 📄 License

Licensed under the [Apache License, Version 2.0](LICENSE).

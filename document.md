# CodeSync Developer Documentation

This document contains technical information regarding the architecture, development commands, and CI/CD pipelines of CodeSync.

---

## 🛠️ Local Installation & Development Setup

If you want to run or test the extension locally, follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/pardeep1916P/codeSync.git
   cd codeSync
   ```
2. **Install Dependencies & Build**:
   ```bash
   npm install
   npm run build
   ```
3. **Load the Extension into Chrome**:
   - Open Google Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** in the top-right corner.
   - Click **Load unpacked** in the top-left corner.
   - Select the `dist/` directory generated in the project root folder.

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
- **Repository Secrets**: To enable OAuth authentication in automated builds, you must add your OAuth credentials as secrets in your GitHub repository (**Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**):
  - `VITE_GITHUB_CLIENT_ID`: Your GitHub OAuth App Client ID.
  - **Security Warning**: Do **NOT** add or inject `VITE_GITHUB_CLIENT_SECRET` in automated CI/CD builds. Any environment variables prefixed with `VITE_` are embedded directly into the compiled client JavaScript code, exposing them to anyone who downloads the release package. Standard production releases should rely on Personal Access Tokens (PAT) or a secure backend authentication proxy.

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

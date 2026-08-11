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
   npm install --legacy-peer-deps
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
- **Automated GitHub Releases & Chrome Web Store Deployment**: On every push to `main` or tag push (`v*`), the workflow automatically compiles the production extension, packages `codesync-extension.zip` and `dist.zip`, publishes to the Chrome Web Store via `chrome-webstore-upload-cli`, and creates/updates the dynamic GitHub Release (`v<version>`).
- **Repository Secrets**: Configure the following secrets in your GitHub repository (**Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**):
  - `VITE_GITHUB_CLIENT_ID`: Your GitHub OAuth App Client ID.
  - `VITE_GITHUB_CLIENT_SECRET`: Your GitHub OAuth App Client Secret.
  - `CHROME_EXTENSION_ID`: Your Chrome Web Store Extension ID (`abdemcedoopepnjfjdbgomcandofbljd`).
  - `CHROME_CLIENT_ID`: Google Cloud OAuth Client ID for Chrome Web Store API.
  - `CHROME_CLIENT_SECRET`: Google Cloud OAuth Client Secret for Chrome Web Store API.
  - `CHROME_REFRESH_TOKEN`: Google Cloud OAuth Refresh Token for Chrome Web Store API.
- **Local Development Environment**: For local testing, copy `.env.example` to `.env` and configure your local credentials. The `.env` file is excluded from Git tracking in `.gitignore` to keep credentials secure.

---

## 📋 OpenSpec Spec-Driven Development Framework

CodeSync uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`@fission-ai/openspec`) for Spec-Driven Development (SDD).

* **Specification Folder**: `openspec/`
* **Configuration**: `openspec/config.yaml`
* **Slash Commands**:
  - `/opsx-propose "feature idea"` — Propose a new spec-driven change.
  - `/openspec-apply` — Execute tasks according to an approved spec proposal.
  - `/openspec-archive` — Archive completed changes into main specifications.

---

## 📂 Project Structure

```
├── .agent/ / .agents/      # OpenSpec AI Agent skills & custom slash commands
├── .github/
│   └── workflows/          # GitHub Actions CI/CD workflows
├── openspec/               # OpenSpec framework specs and change proposals
├── public/                 # Extension icons and Manifest configuration
├── src/
│   ├── background/         # Service worker managing queue alarms and events
│   ├── content/            # Main-world fetch/XHR network interceptor & isolated bridge
│   ├── github/             # Git Trees API client and OAuth integrations
│   ├── queue/              # Submission commit queue logic and README updates
│   ├── store/              # Global state managed via Zustand (storage caching)
│   ├── styles/             # Core CSS theme tokens and global styles
│   └── popup/              # Main Dashboard React user interface
├── README.md               # Repository documentation
└── vite.config.ts          # Vite build configuration
```

# CodeSync

<p align="center">
  <img src="public/showcase.png" alt="CodeSync Showcase" width="600" />
</p>

CodeSync is a modern, lightweight, and gorgeous browser extension that automatically captures your accepted LeetCode submissions and synchronizes them directly to your personal GitHub repository. Built with a state-of-the-art terminal-inspired UI, it features full custom theme support and instant background synchronization.

---

## 🚀 Key Features

* **Bulletproof Network Interception**: Instantly catches accepted LeetCode solutions at the network layer, completely bypassing fragile DOM scraping.
* **Instant & Local Sync**: Toggle "Instant Sync" to push solutions the second they are accepted, or turn it off to hold them in a pending queue.
* **Smart Pending Queue**: Manage queued submissions from a card dashboard. Delete individual entries, clear the entire queue, or activate auto-sync to trigger immediate processing.
* **Deduplication & Sequential Chaining**: CodeSync automatically resolves duplicate submissions and uploads your code sequentially to avoid commits conflicts.
* **15+ Custom Themes**: Swap between beautiful terminal themes (AMOLED, Dracula, Tokyo Night, Cyberpunk, Matrix, Nord, and more) on the fly.
* **Zero Console Noise**: 100% silent and optimized for production. No developer logs or errors printed to your browser console.

---

## 🛠️ Installation & Setup

1. **Download and Build**:
   ```bash
   git clone https://github.com/pardeep1916P/codeSync.git
   cd codeSync
   npm install
   npm run build
   ```
2. **Load into Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (top right corner).
   - Click **Load unpacked** (top left corner).
   - Select the `dist/` folder in the project directory.
3. **Configure**:
   - Open CodeSync from your extension tray.
   - Connect using **OAuth Login** or paste your **GitHub Personal Access Token** (with `repo` scopes).
   - Select your target repository, enable Auto-Sync, and start coding on LeetCode!

---

## 📂 Developer Guides & Resources

For detailed developer instructions, building commands, project structure details, and CI/CD release workflow configuration, see the [Developer Documentation](document.md).

---

## 📄 License

Licensed under the [Apache License, Version 2.0](LICENSE).

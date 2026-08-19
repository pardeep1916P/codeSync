# CodeSync

<p align="center">
  <img src="docs/assets/showcase.png" alt="CodeSync Showcase" width="550" />
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd">
    <img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?style=for-the-badge&logo=googlechrome&logoColor=white&label=Chrome%20Web%20Store&color=emerald" alt="Chrome Web Store" />
  </a>
  <a href="https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj">
    <img src="https://img.shields.io/badge/Edge_Add--ons-v1.0.0-blue?style=for-the-badge&logo=microsoftedge&logoColor=white" alt="Microsoft Edge" />
  </a>
  <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd">
    <img src="https://img.shields.io/badge/Brave_Browser-Compatible-orange?style=for-the-badge&logo=brave&logoColor=white" alt="Brave" />
  </a>
  <a href="https://github.com/pardeep1916P/codeSync/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/pardeep1916P/codeSync/release.yml?branch=main&style=for-the-badge&label=Build%20%26%20Deploy" alt="Build Status" />
  </a>
  <a href="https://github.com/pardeep1916P/codeSync/releases">
    <img src="https://img.shields.io/github/v/release/pardeep1916P/codeSync?style=for-the-badge&logo=github&color=blue&label=Release" alt="Latest Release" />
  </a>
</p>

CodeSync is a lightweight and beautiful browser extension that automatically saves your accepted LeetCode submissions and pushes them directly to your personal GitHub repository. Built with a sleek terminal-inspired design, it gives you a centralized dashboard to track your solved problems, manage pending commits, and customize themes to match your coding setup.

---

<div align="center">

## 🌐 Supported Browsers & Deployment Status

| Browser | Channel | Deployment Status | Live Version |
| :---: | :---: | :---: | :---: |
| <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/chrome/chrome_48x48.png" width="36" alt="Google Chrome" /><br><b>Google Chrome</b></a> | [Chrome Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) | `✅ Deployed & Live` | <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?label=version&color=emerald&style=flat-square" alt="Chrome Version" /></a> |
| <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/brave/brave_48x48.png" width="36" alt="Brave" /><br><b>Brave</b></a> | [Install via Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) | `✅ Supported` | <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?label=version&color=emerald&style=flat-square" alt="Brave Version" /></a> |
| <a href="https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/edge/edge_48x48.png" width="36" alt="Microsoft Edge" /><br><b>Microsoft Edge</b></a> | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj) | `✅ Deployed & Live` | <a href="https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj"><img src="https://img.shields.io/badge/edge-v1.0.0-blue?style=flat-square" alt="Edge Version" /></a> |
| <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/vivaldi/vivaldi_48x48.png" width="36" alt="Vivaldi" /><br><b>Vivaldi</b></a> | [Install via Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) | `✅ Supported` | <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?label=version&color=emerald&style=flat-square" alt="Vivaldi Version" /></a> |
| <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/opera/opera_48x48.png" width="36" alt="Opera" /><br><b>Opera / Opera GX</b></a> | [Install via Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) | `✅ Supported` | <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?label=version&color=emerald&style=flat-square" alt="Opera Version" /></a> |

</div>

---


## ✨ Key Features

* **⚡ Instant Auto-Sync**: Pushes your accepted LeetCode solutions to GitHub the moment you solve them.
* **📥 Pending Commit Queue**: Keep Auto-Sync off to hold your solutions in a local queue, allowing you to review, delete, or sync them manually whenever you want.
* **🔄 Smart Deduplication**: If you submit the same problem multiple times, CodeSync automatically updates the queue with your latest solution so you never push duplicate commits.
* **🎨 15+ Curated Themes**: Choose from vibrant layouts (AMOLED, Dracula, Tokyo Night, Cyberpunk, Matrix, Nord, and more) to fit your dark mode aesthetic.
* **🔒 Private & Secure**: Authenticate securely using GitHub OAuth or your own Personal Access Token (PAT). Your credentials are saved locally in your browser storage.
* **🚀 Lightweight & Silent**: Zero background battery drain and 100% silent runtime with no console log noise.

---

## 🚀 Easy Setup Guide

### Step 1: Install the Extension
1. Install CodeSync from the [Chrome Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) or the [Microsoft Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj).

### Step 2: Connect your GitHub Account
1. Click the **CodeSync** icon in your browser extension toolbar.
2. Click **Authenticate with OAuth** to log in instantly, or enter a **GitHub Personal Access Token (PAT)** with `repo` permissions.
3. Select your target repository from the dropdown.
4. Toggle **Auto-Sync** to active, and start solving problems on LeetCode!

---

## 🛠️ Developer Documentation

Are you looking to modify the extension, run local tests, or configure CI/CD release pipelines? Check out our [Developer Guide](document.md).

---

## 📄 License & Privacy

Licensed under the [Apache License, Version 2.0](LICENSE).  
Read our [Privacy Policy](PRIVACY.md).

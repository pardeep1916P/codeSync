# CodeSync

<p align="center">
  <img src="docs/assets/showcase.png" alt="CodeSync Showcase" width="550" />
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd">
    <img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?style=for-the-badge&logo=googlechrome&logoColor=white&label=Chrome%20Web%20Store&color=emerald" alt="Chrome Web Store" />
  </a>
  <a href="https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj">
    <img src="https://img.shields.io/github/v/release/pardeep1916P/codeSync?style=for-the-badge&logo=microsoftedge&logoColor=white&label=Edge%20Add--ons&color=blue" alt="Microsoft Edge" />
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

CodeSync is a lightweight and modern browser extension that automatically syncs your accepted coding problem submissions directly to your personal GitHub repository in real time.

---

<div align="center">

## 🌐 Supported Browsers

| Browser | Channel | Status | Version |
| :---: | :---: | :---: | :---: |
| <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/chrome/chrome_48x48.png" width="32" alt="Google Chrome" /><br><b>Chrome</b></a> | [Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) | `✅ Live` | <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?label=version&color=emerald&style=flat-square" alt="Chrome Version" /></a> |
| <a href="https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/edge/edge_48x48.png" width="32" alt="Microsoft Edge" /><br><b>Edge</b></a> | [Add-ons](https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj) | `✅ Live` | <a href="https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj"><img src="https://img.shields.io/github/v/release/pardeep1916P/codeSync?label=version&color=blue&style=flat-square" alt="Edge Version" /></a> |
| <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/brave/brave_48x48.png" width="32" alt="Brave" /><br><b>Brave</b></a> | [Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) | `✅ Supported` | <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?label=version&color=emerald&style=flat-square" alt="Brave Version" /></a> |
| <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/opera/opera_48x48.png" width="32" alt="Opera" /><br><b>Opera</b></a> | [Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) | `✅ Supported` | <a href="https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd"><img src="https://img.shields.io/chrome-web-store/v/abdemcedoopepnjfjdbgomcandofbljd?label=version&color=emerald&style=flat-square" alt="Opera Version" /></a> |

</div>

---

## ✨ Key Features

* **⚡ Instant Sync (<10ms Enqueue)**: Captures accepted solutions immediately on submission.
* **🕒 Authentic Historical Timestamps**: Historical solves committed to GitHub reflect their original timestamp on your contribution graph.
* **🌐 Multi-Platform Ready**: Support for LeetCode, Codeforces, HackerRank, and GeeksforGeeks.
* **📂 Custom Repository Layouts**: Choose between Flat (`{slug}/`), Platform (`{platform}/{slug}/`), or Difficulty (`{platform}/{difficulty}/{slug}/`) folders.
* **📥 Pending Commit Queue**: Review, manage, or sync submissions in bulk whenever you want.
* **🔄 Smart Deduplication**: Automatically updates existing solutions when re-solving problems.
* **🎨 15+ Aesthetic Themes**: Dark mode themes including AMOLED, Dracula, Tokyo Night, Cyberpunk, and Matrix.
* **🔒 Encrypted & Private**: Secure GitHub OAuth and Personal Access Token login with AES-GCM (256-bit) encryption at rest.

---

## 🚀 Quick Start

1. **Install CodeSync** from the [Chrome Web Store](https://chromewebstore.google.com/detail/codesync/abdemcedoopepnjfjdbgomcandofbljd) or [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/codesync/mhfhhccgklfjjgplmgkcoafobidjhhmj).
2. Click the extension icon and **Connect your GitHub account** via OAuth or Personal Access Token.
3. Select your target repository and start solving problems!

---

## 🛠️ Developer Guide

For local setup, architecture diagrams, testing, and CI/CD pipelines, see the [Developer Documentation](document.md).

---

## 📄 License & Privacy

Licensed under the [Apache License, Version 2.0](LICENSE).  
Read our [Privacy Policy](PRIVACY.md).

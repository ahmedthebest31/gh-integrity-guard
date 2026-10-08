# 🛡️ GitHub Integrity Guard

[![GitHub License](https://img.shields.io/github/license/ahmedthebest31/gh-integrity-guard?color=green)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![A11y Compliant](https://img.shields.io/badge/Accessibility-100%25-blue)](README.md)

GitHub Integrity Guard is an advanced, privacy-first browser extension architected to eliminate star-farming deception. It injects a real-time, highly accessible scorecard directly into GitHub repositories, analyzing authentic community health and protecting independent developers from bot-driven metrics.

---

## ⚙️ How It Works (The Engine & UI)

The extension acts as a silent auditor working directly within your browser, ensuring maximum transparency without cluttering your workflow:

* 🧠 **100% AI-Free & Deterministic:** No black-box AI algorithms, no LLM hallucinations, and no API bloat. Just pure, transparent mathematical logic.
* 🔑 **Optional Token Boost:** Works out of the box on GitHub's free API limit. Add a Personal Access Token (PAT) to raise the limit to 5,000 requests per hour; it is encrypted locally via AES-GCM and never leaves your machine.
* 💉 **Smart UI Injection:** The extension seamlessly injects a clean Scorecard into the native GitHub sidebar. If the sidebar is missing, a resilient **Floating Card** automatically appears.
* 🚦 **Visual Transparency:** The card displays a definitive Trust Score (out of 100) using a traffic-light color system: **Red (Danger)**, **Yellow (Warning)**, and **Green (Healthy)**.
* 📊 **Full Breakdown:** It exposes the raw numbers underneath the score (Fork-to-Star ratio, 90-day Commits, Issue Health, and Discussion Depth).
* 💾 **24-Hour Smart Cache:** Successful audits are cached locally for 24 hours, which keeps the free 60 requests/hour limit healthy. Visiting the same repository twice won't trigger redundant network requests.

---

## ♿ Uncompromised Accessibility 

Built by a blind software engineer, this tool actively rejects cluttered charts in favor of pure semantic data:

* 🔊 **Instant Audio Briefing:** The moment a repository loads, a visually-hidden `aria-live` region reads a concise summary of the Trust Score directly to your screen reader.
* 📋 **Accessible Export:** A dedicated native button allows you to copy the entire metrics breakdown to your clipboard with an instant audio confirmation.
* ⌨️ **Keyboard Native:** Every element, from the floating card dismissal to the options page, is strictly navigable via keyboard.

---

## 🧮 The Tiered Scoring Architecture

To prevent penalizing new or niche projects, the algorithm dynamically adjusts its rules based on the repository's total stars:

* 🌱 **Tier 1 (Incubator | < 200 Stars):** Baseline 90+ score. Focuses purely on absolute stagnation (penalized only if dormant for > 365 days).
* 📈 **Tier 2 (Growth | 200 - 5,000 Stars):** Pulse-focused auditing. Rewards active commit cadence and community issue discussions over raw fork numbers.
* 🏛️ **Tier 3 (Established | 5,000 - 10,000 Stars):** Balanced auditing. Matches organic community adoption with the project's growing popularity.
* 🐋 **Tier 4 (High-Traffic | > 10,000 Stars):** Strict anti-fraud enforcement. Hard-caps scores at 30 (Danger Zone) if the fork ratio falls below 3% to kill bot farms.

---

## 📥 Installation

### 🌐 Official Stores (Recommended)
You can install GitHub Integrity Guard directly from your browser's official web store:
* **Google Chrome / Microsoft Edge:** [Install from Chrome Web Store](https://chromewebstore.google.com/detail/github-integrity-guard/ffmjlnmfgggbfpiidebpfdehfipehcla)
* **Mozilla Firefox:** [Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/github-integrity-guard/)

### 🛠️ Build From Source (For Developers)
If you prefer to inspect the code or build it manually:
* Step 1: Clone this repository locally (`git clone https://github.com/ahmedthebest31/gh-integrity-guard.git`).
* Step 2: Open your browser's extension management page (`chrome://extensions` or `about:debugging` in Firefox).
* Step 3: Enable **Developer Mode**.
* Step 4: Click **Load Unpacked** (or **Load Temporary Add-on**) and select the `src` folder inside the cloned project.

---

## 🔑 Setup & Privacy (Zero Telemetry)

No setup required. The extension audits repositories immediately using GitHub's free public API limit (60 requests per hour, kept low via 24-hour local caching). A token is optional and only raises the limit to 5,000 requests per hour.

* **Step 1 (Optional — Generate):** You can skip this for zero-config use, or retrieve your existing token via terminal by running `gh auth token`, or generate a new minimal-scope token from your GitHub Developer Settings.
* **Step 2 (Optional — Configure):** Open the extension's **Options** page (right-click the extension icon and select Options), paste your token, and save.
* **🔒 Military-Grade Local Encryption:** Your token is immediately encrypted locally using industry-standard AES-GCM via the native Web Crypto API. 
* **🚫 Zero Telemetry:** Your data never leaves your device. We do not track you, we do not collect analytics, and there are zero external servers involved. Everything is stored locally in your browser.
* **🗑️ Full Control:** You can permanently delete or update your encrypted token at any time directly from the Options page.

## 🗺️ Roadmap

* 👤 **Human Verification Layer:** Adding a community reporting feature to manually flag repositories with inaccurate scores to train and refine the grading algorithm.
* 🌍 **Localization:** Multi-language support for screen reader narrations (including Arabic).

---

## 🤝 Contributing

Contributions are completely open! Whether you want to optimize the algorithms, fix a bug, enhance the UI, or improve documentation, your Pull Requests are highly welcome. Please ensure your commits adhere to the Conventional Commits specification.

---

## 📜 License

This project is open-source and licensed under the terms of the **MIT License**. See the `LICENSE` file for more details.

---

## ✉️ A Message from the Developer

As a blind software engineer, the open-source community is my absolute lifeline. Projects like the [NVDA screen reader](https://www.nvaccess.org/) are the fundamental reason I can use a computer and write code every day. I built this extension to give back to this incredible ecosystem and keep it clean from bot manipulation. Going entirely against the current trend, this tool is strictly AI-free—relying solely on pure math, deterministic logic, and zero-chart accessibility to ensure independent creators get the fair exposure they deserve.
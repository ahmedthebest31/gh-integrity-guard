# GitHub Integrity Guard

[![License](https://img.shields.io/github/license/ahmedthebest31/gh-integrity-guard?color=brightgreen)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-1a73e8?logo=chrome&logoColor=white)](https://chromewebstore.google.com/detail/github-integrity-guard/ffmjlnmfgggbfpiidebpfdehfipehcla)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-Install-ff7139?logo=firefox&logoColor=white)](https://addons.mozilla.org/firefox/addon/github-integrity-guard/)

GitHub Integrity Guard is a browser extension that shows a clear trust score from 0 to 100 on every GitHub repository you visit. It reads public repository data through the official GitHub API, calculates the score entirely inside your browser, and shows the result in the repository sidebar (or as a floating card when the sidebar is missing).

The whole point is simple: star counts are easy to fake, so we look past them. The score is built from four measurable signals:

- the ratio of forks to stars,
- commit activity over the last 90 days,
- how quickly issues get closed,
- and how much real community discussion is going on.

There is no AI anywhere in this project. No black-box models, no guesswork, no tracking, no servers. The same repository always gets the same score, and every number behind it can be checked by hand on the repository page.

---

## How the score works

The score uses a fixed, transparent formula with four tiers, so small or new projects are never punished for not having thousands of stars:

- Tier 1 (Incubator, under 200 stars) — small and new projects are trusted by default and only penalized if they are completely dormant for more than a year.
- Tier 2 (Growth, 200 to 5,000 stars) — focused on activity. Rewards a steady commit cadence and healthy issue discussions over raw fork counts.
- Tier 3 (Established, 5,000 to 10,000 stars) — balanced check of community adoption and ongoing work.
- Tier 4 (High-Traffic, over 10,000 stars) — the strictest rules. If the fork-to-star ratio drops below 3%, the score is capped at 30 to catch inflated metrics.

The result is color-coded: red under 40 (danger), yellow up to 70 (warning), and green above that (healthy). Successful audits are cached locally for 24 hours, so revisiting the same repository does not burn extra requests from your GitHub quota.

---

## Accessibility

The extension is built for screen readers first — it is written by a blind developer, and every design choice follows from that:

- When a repository loads, a visually-hidden aria-live region reads a short summary of the score to your screen reader.
- The floating card can be dismissed and opened entirely from the keyboard.
- A dedicated button copies the full metrics breakdown to the clipboard and confirms the copy out loud.
- No charts, no graphs, no images — the card is plain text that a screen reader can read top to bottom.

---

## Install

### From the official stores

<a href="https://chromewebstore.google.com/detail/github-integrity-guard/ffmjlnmfgggbfpiidebpfdehfipehcla" style="display:inline-block;margin:4px 12px 4px 0;padding:12px 22px;background:#1a73e8;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;">Install for Chrome</a> <a href="https://addons.mozilla.org/firefox/addon/github-integrity-guard/" style="display:inline-block;margin:4px 0;padding:12px 22px;background:#c43a16;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;">Install for Firefox</a>

### From source

If you prefer to inspect or build the code yourself:

1. Clone this repository locally.
2. Open your browser's extension management page (chrome://extensions, or about:debugging in Firefox).
3. Enable Developer Mode.
4. Click Load Unpacked (or Load Temporary Add-on) and select the `src` folder inside the cloned project.

---

## Privacy

The extension works without any account or setup. An optional GitHub Personal Access Token only raises your API limit from 60 to 5,000 requests per hour:

- The token is encrypted locally with AES-GCM using the browser's native Web Crypto API and never leaves your machine.
- You can update or permanently delete it anytime from the Options page.
- There is no telemetry, no analytics, and no server of ours. Nothing is collected.

See [PRIVACY.md](PRIVACY.md) for the full policy.

---

## Store listing assets

Everything used to publish the extension on the Chrome Web Store and Firefox Add-ons lives in the `store/` folder:

- `store/STORE_LISTING.md` — the listing copy for both stores.
- `store/icon-128.png` and `store/icon-512.png` — the official icons.
- `store/promo-440x280.png` — the Chrome Web Store promo tile.
- `store/screenshots/` — five 1280x800 screenshots (one full page plus one card per scoring tier).
- `store/originals/` — the high-resolution 2x captures the screenshots were resized from.

---

## Roadmap

- A community reporting layer so inaccurate scores can be flagged manually.
- Localization of the screen-reader announcements, including Arabic.

---

## Contributing

Pull requests are welcome. Keep the accessibility bar high: no non-semantic charts, and every change must remain fully navigable by keyboard and screen reader. Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

### 📄 License

[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) — see the [LICENSE](LICENSE) file for details.

---

## A note from the developer

Being a blind engineer, the open-source community is what makes it possible for me to write code at all — NVDA is the reason I can use a computer the way I do every day. This extension is my way of giving back and keeping GitHub honest, one repository at a time. That is why it is deliberately AI-free: pure math, deterministic rules, and numbers anyone can read.
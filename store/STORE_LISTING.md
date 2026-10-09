# GitHub Integrity Guard — Store Listing Copy

## Title (Chrome Web Store + Firefox AMO)

GitHub Integrity Guard

## Short description (Chrome: "Summary" field, max 132 chars; Firefox: "Summary")

0 to 100 trust score for GitHub repos. Checks stars, forks, commits & issues locally. Pure formula, zero AI, zero tracking.

## Detailed description (Chrome: "Detailed description"; Firefox: "Detailed description")

Is this GitHub repository trustworthy?

GitHub Integrity Guard is a 100% open-source, lightweight browser extension built with zero external dependencies. It shows a plain trust score from 0 to 100 directly on every GitHub repository you visit, exposing inflated metrics and highlighting healthy projects.

The score is calculated from four measurable signals:
- the ratio of forks to stars (tiered by repository size so smaller or newer projects are never penalized),
- commit activity over the last 90 days,
- how quickly issues get closed,
- and organic community discussion depth.

Pure formula, zero AI hallucinations
This is not an AI product. There are no black-box models, no guesswork, and zero hallucinations. The score is computed using a fixed, transparent formula: the exact same repository always gets the exact same score. Every metric comes straight from numbers you can check yourself on the repository page.

How it works
The extension reads public data through GitHub's API, computes the score on your own machine, and displays the card in the repository sidebar (or as a resilient floating card). Audits are cached locally for 24 hours to prevent redundant requests and keep your usage minimal.

Engineered for accessibility
Built with strict accessibility standards, rejecting cluttered charts in favor of pure semantic structure:
- Instant screen-reader announcements via aria-live regions upon loading.
- Full keyboard navigation across every UI element and setting.
- Accessible one-click shortcut to copy the full metrics breakdown to your clipboard.

Zero telemetry & full token control
- No setup required: works instantly on GitHub's free anonymous limit (60 requests/hour).
- Optional PAT boost: adding a Personal Access Token is entirely optional and only raises the limit to 5,000 requests/hour.
- Local encryption: tokens are encrypted locally on your device via AES-GCM and never leave your browser.
- Full control: update, change, or permanently delete your stored token at any time directly from the Options page.
- Absolute privacy: no tracking, no analytics, and zero external servers.

What the score is not
The score is an activity and health indicator built from public data. It helps you quickly spot suspicious repositories and understand active ones. It is not an absolute security guarantee; treat it as one reliable signal among many.

100% Open Source:
Inspect the code or contribute directly on GitHub:
https://github.com/ahmedthebest31/gh-integrity-guard
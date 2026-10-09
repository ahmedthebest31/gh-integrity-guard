# Privacy Policy for GitHub Integrity Guard

**Effective Date:** October 2026

GitHub Integrity Guard ("the Extension") is an open-source browser extension licensed under the GNU General Public License v3.0. We are committed to protecting your data and privacy.

## Data Collection and Telemetry
**Zero Telemetry:** The Extension does not collect, track, store, or transmit any personal data, analytics, or usage statistics to any external servers. Audit results are cached locally in your browser's storage for 24 hours so the same repository is not re-requested on every visit; that cache stays on your device and is never sent anywhere. 
## Personal Access Token (PAT)

The GitHub Personal Access Token is fully optional. The Extension works out of the box on GitHub's free API limit; a token only raises that limit.
* Your token is strictly stored locally on your device.
* It is encrypted using industry-standard AES-GCM via the native Web Crypto API.
* The token is only used to authenticate direct requests between your browser and the official GitHub API (`api.github.com`).
* We do not have access to your token, and it never leaves your machine.

## Third-Party Services
The Extension interacts solely with the official GitHub API to fetch repository metadata. No other third-party services, APIs, or AI models are used.

## External Links
The only external pages the Extension ever opens are official GitHub pages, for example the token creation page from the Options screen or the error card. Nothing else is loaded, embedded, or contacted.

## Contact
If you have any questions about this Privacy Policy, please open an issue on our GitHub repository.
/**
 * @fileoverview Content script for GitHub Integrity Guard.
 * Injects a placeholder Trust Score card into the GitHub repository sidebar.
 */

const INTEGRITY_CARD_ID = 'gh-integrity-guard-card';

/**
 * Inline style constants reused across the card.
 */
const CARD_STYLES = {
  wrapper: `
    border: 1px solid var(--color-border-default);
    border-radius: 6px;
    padding: 16px;
    margin-top: 16px;
    margin-bottom: 16px;
    background-color: var(--color-canvas-subtle);
    color: var(--color-fg-default);
  `,
  scoreBox: `
    background-color: var(--color-canvas-default);
    border: 1px solid var(--color-border-muted);
    border-radius: 6px;
    padding: 12px;
    text-align: center;
  `,
  scoreValue: `
    font-size: 28px;
    font-weight: bold;
    color: var(--color-fg-default);
  `,
  metricRow: `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 12px;
    color: var(--color-fg-muted);
  `,
  progressTrack: `
    width: 60px;
    height: 6px;
    background-color: var(--color-border-muted);
    border-radius: 3px;
    overflow: hidden;
    margin-left: 8px;
  `,
  redFlagBanner: `
    display: none;
    background-color: var(--color-danger-subtle, rgba(255,129,130,0.1));
    color: var(--color-danger-fg);
    border: 1px solid var(--color-danger-emphasis, #cf222e);
    border-radius: 6px;
    padding: 8px;
    margin-top: 8px;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
  `,
};

/**
 * Creates the DOM element for the Integrity Score card.
 * @returns {HTMLElement} The constructed card element.
 */
const createIntegrityCard = () => {
  const card = document.createElement('div');
  card.id = INTEGRITY_CARD_ID;

  card.className = 'BorderGrid-row';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'GitHub Integrity Guard — Trust Score');
  card.setAttribute('aria-live', 'polite');
  card.style.cssText = CARD_STYLES.wrapper;

  card.innerHTML = `
    <div class="BorderGrid-cell">
      <h2 class="h4 mb-2 d-flex flex-justify-between flex-items-center">
        <span>🛡️ Integrity Score</span>
        <span data-ig-status class="color-fg-muted text-small">Pending</span>
      </h2>

      <!-- Score display -->
      <div style="${CARD_STYLES.scoreBox}">
        <span data-ig-score style="${CARD_STYLES.scoreValue}">--/100</span>
        <p data-ig-label class="text-small color-fg-muted mt-1 mb-0">Analyzing repository health…</p>
      </div>

      <!-- Metric breakdown -->
      <div data-ig-breakdown style="margin-top: 10px; display: none;">
        <div style="${CARD_STYLES.metricRow}">
          <span>Forks / Stars</span>
          <div style="display: flex; align-items: center;">
            <span data-ig-forks-pts></span>
            <div style="${CARD_STYLES.progressTrack}">
              <div data-ig-forks-bar style="height: 100%; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
        <div style="${CARD_STYLES.metricRow}">
          <span>Commit Activity</span>
          <div style="display: flex; align-items: center;">
            <span data-ig-commits-pts></span>
            <div style="${CARD_STYLES.progressTrack}">
              <div data-ig-commits-bar style="height: 100%; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
        <div style="${CARD_STYLES.metricRow}">
          <span>Issue Health</span>
          <div style="display: flex; align-items: center;">
            <span data-ig-issues-pts></span>
            <div style="${CARD_STYLES.progressTrack}">
              <div data-ig-issues-bar style="height: 100%; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Red flag banner -->
      <div data-ig-redflag style="${CARD_STYLES.redFlagBanner}" role="alert">
        ⚠️ Red Flag: Abnormally low fork ratio for a popular repository
      </div>

      <!-- Screen reader summary (visually hidden) -->
      <span data-ig-sr-summary class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;"></span>
    </div>
  `;

  return card;
};

/**
 * Maps the scoring color key to a Primer CSS variable.
 * @param {string} colorKey - 'danger' | 'warning' | 'healthy'
 * @returns {string} CSS variable reference.
 */
const colorToCssVar = (colorKey) => {
  const map = {
    danger:  'var(--color-danger-fg)',
    warning: 'var(--color-attention-fg)',
    healthy: 'var(--color-success-fg)',
  };
  return map[colorKey] ?? 'var(--color-fg-default)';
};

/**
 * Fills a mini progress bar element.
 * @param {HTMLElement} bar
 * @param {number} points
 * @param {number} max
 * @param {string} cssColor
 */
const fillBar = (bar, points, max, cssColor) => {
  const pct = Math.round((points / max) * 100);
  bar.style.width = `${pct}%`;
  bar.style.backgroundColor = cssColor;
};

/**
 * Updates the sidebar card with a full score result or a simple error object.
 *
 * Accepts two shapes:
 *   Rich result : { score, color, label, redFlag, breakdown }
 *   Error result: { score: string, status: string }
 *
 * @param {Object} scoreData
 */
const updateCardWithScore = (scoreData) => {
  const card = document.getElementById(INTEGRITY_CARD_ID);
  if (!card) return;

  const $ = (sel) => card.querySelector(sel);

  const scoreEl     = $('[data-ig-score]');
  const labelEl     = $('[data-ig-label]');
  const statusEl    = $('[data-ig-status]');
  const breakdownEl = $('[data-ig-breakdown]');
  const redFlagEl   = $('[data-ig-redflag]');
  const srSummary   = $('[data-ig-sr-summary]');

  // ── Error / simple result (no breakdown) ──
  if (!scoreData.breakdown) {
    if (scoreEl)  scoreEl.textContent = `${scoreData.score}/100`;
    if (labelEl)  labelEl.textContent = scoreData.status || '';
    if (statusEl) statusEl.textContent = 'Error';
    return;
  }

  // ── Rich result ──
  const { score, color, label, redFlag, breakdown } = scoreData;
  const cssColor = colorToCssVar(color);

  // Header
  if (statusEl) statusEl.textContent = label;

  // Score number
  if (scoreEl) {
    scoreEl.textContent = `${score}/100`;
    scoreEl.style.color = cssColor;
  }

  // Label text
  if (labelEl) labelEl.textContent = `${label} — ${breakdown.forks.note}`;

  // Breakdown section
  if (breakdownEl) {
    breakdownEl.style.display = 'block';

    const forksPts   = $('[data-ig-forks-pts]');
    const forksBar   = $('[data-ig-forks-bar]');
    const commitsPts = $('[data-ig-commits-pts]');
    const commitsBar = $('[data-ig-commits-bar]');
    const issuesPts  = $('[data-ig-issues-pts]');
    const issuesBar  = $('[data-ig-issues-bar]');

    if (forksPts)   forksPts.textContent   = `${breakdown.forks.points}/${breakdown.forks.max}`;
    if (forksBar)   fillBar(forksBar,   breakdown.forks.points,   breakdown.forks.max,   cssColor);
    if (commitsPts) commitsPts.textContent = `${breakdown.commits.points}/${breakdown.commits.max}`;
    if (commitsBar) fillBar(commitsBar, breakdown.commits.points, breakdown.commits.max, cssColor);
    if (issuesPts)  issuesPts.textContent  = `${breakdown.issues.points}/${breakdown.issues.max}`;
    if (issuesBar)  fillBar(issuesBar,  breakdown.issues.points,  breakdown.issues.max,  cssColor);
  }

  // Red Flag banner
  if (redFlagEl && redFlag) {
    redFlagEl.style.display = 'block';
  }

  // Screen reader summary
  if (srSummary) {
    srSummary.textContent = [
      `Trust Score: ${score} out of 100, rated ${label}.`,
      `Fork to Star ratio scored ${breakdown.forks.points} of ${breakdown.forks.max}: ${breakdown.forks.note}.`,
      `Commit activity scored ${breakdown.commits.points} of ${breakdown.commits.max}: ${breakdown.commits.note}.`,
      `Issue health scored ${breakdown.issues.points} of ${breakdown.issues.max}: ${breakdown.issues.note}.`,
      redFlag ? 'Red flag: abnormally low fork ratio for a popular repository.' : '',
    ].filter(Boolean).join(' ');
  }
};

/**
 * Maps GitHubApiError status codes to user-friendly card messages.
 * @param {Error} error
 * @returns {{ score: string, status: string }}
 */
const buildErrorDisplay = (error) => {
  if (error.name === 'GitHubApiError') {
    switch (error.status) {
      case 401:
        return { score: '!', status: 'Invalid token — check Options page' };
      case 403:
      case 429: {
        const retry = error.retryAfter ? ` (resets in ${error.retryAfter}s)` : '';
        return { score: '!', status: `Rate limited${retry}` };
      }
      case 404:
        return { score: 'N/A', status: 'Repository not found' };
      default:
        return { score: '!', status: `API error (${error.status})` };
    }
  }
  return { score: '!', status: 'Unexpected error' };
};

/**
 * Injects the Integrity Score card into the GitHub repository sidebar.
 * Follows a cache-first strategy: reads from chrome.storage.local before
 * making any network requests to the GitHub API.
 */
const injectCardIntoSidebar = async () => {
  const sidebar = document.querySelector('.Layout-sidebar');

  // Exit if not on a repository page (no sidebar) or if already injected
  if (!sidebar || document.getElementById(INTEGRITY_CARD_ID)) {
    return;
  }

  const card = createIntegrityCard();

  // Inject at the top of the sidebar
  if (sidebar.firstChild) {
    sidebar.insertBefore(card, sidebar.firstChild);
  } else {
    sidebar.appendChild(card);
  }

  // Extract owner/repo from the URL path
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length < 2) return;

  const [owner, repo] = pathParts;
  const repoFullName = `${owner}/${repo}`;
  const cacheKey = `repo_score_${repoFullName}`;

  try {
    // Dynamically import modules (content scripts can't use static imports)
    const storageUrl = chrome.runtime.getURL('storage.js');
    const serviceUrl = chrome.runtime.getURL('github-service.js');
    const [StorageUtil, GitHubService] = await Promise.all([
      import(storageUrl),
      import(serviceUrl),
    ]);

    // ── 1. Cache check ──────────────────────────────────────────────────────
    const cached = await StorageUtil.getWithExpiry(cacheKey);

    if (cached) {
      console.log(`[gh-integrity-guard] Cache hit for ${repoFullName}`);
      updateCardWithScore(cached);
      return;
    }

    // ── 2. Fetch from GitHub API ────────────────────────────────────────────
    console.log(`[gh-integrity-guard] Cache miss — fetching data for ${repoFullName}`);
    const repoData = await GitHubService.fetchRepoMetadata(owner, repo);

    // ── 3. Calculate score ──────────────────────────────────────────────────
    const scoreData = GitHubService.calculateTrustScore(repoData);

    // ── 4. Persist to cache with 24-hour TTL ────────────────────────────────
    await StorageUtil.setWithExpiry(cacheKey, scoreData, 1440);
    updateCardWithScore(scoreData);
  } catch (error) {
    console.error(`[gh-integrity-guard] Failed to process ${repoFullName}:`, error);
    updateCardWithScore(buildErrorDisplay(error));
  }
};

/**
 * Initializes the content script by attempting injection and setting up listeners.
 */
const init = () => {
  // Attempt immediate injection
  injectCardIntoSidebar();

  // Handle GitHub's client-side navigation (Turbo/Pjax)
  document.addEventListener('turbo:load', injectCardIntoSidebar);
  document.addEventListener('pjax:end', injectCardIntoSidebar);

  // Fallback: observe dynamic DOM changes to catch delayed sidebar rendering
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        const sidebar = document.querySelector('.Layout-sidebar');
        if (sidebar && !document.getElementById(INTEGRITY_CARD_ID)) {
          injectCardIntoSidebar();
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

// Start the initialization process
init();

/**
 * @fileoverview Content script for GitHub Integrity Guard.
 * Injects a Trust Score card into the GitHub repository sidebar, with a
 * floating bottom-right fallback for small screens or missing sidebar.
 * Includes a Copy-to-Clipboard button with full accessibility support.
 */

const INTEGRITY_CARD_ID = 'gh-integrity-guard-card';
const SIDEBAR_WAIT_MS = 3000;
const SMALL_SCREEN_PX = 768;

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_STYLES = {
  wrapper: `
    border: 1px solid var(--color-border-default, #d0d7de);
    border-radius: 6px;
    padding: 16px;
    margin-top: 16px;
    margin-bottom: 16px;
    background-color: var(--color-canvas-subtle, #f6f8fa);
    color: var(--color-fg-default, #24292f);
  `,
  floating: `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    width: 320px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    box-shadow: 0 12px 28px rgba(0,0,0,0.5);
    border: 1px solid var(--color-border-default, #30363d);
    border-radius: 12px;
    padding: 16px;
    background-color: var(--color-canvas-default, #0d1117);
    color: var(--color-fg-default, #c9d1d9);
    backdrop-filter: blur(8px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  `,
  closeBtn: `
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: var(--color-fg-muted, #8b949e);
    padding: 0 4px;
    line-height: 1;
  `,
  copyBtn: `
    background: none;
    border: 1px solid var(--color-border-default, #30363d);
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 6px;
    color: var(--color-fg-muted, #8b949e);
    line-height: 1;
    font-size: 14px;
    transition: color 0.2s ease, border-color 0.2s ease;
  `,
  scoreBox: `
    background-color: var(--color-canvas-default, #0d1117);
    border: 1px solid var(--color-border-muted, #21262d);
    border-radius: 6px;
    padding: 12px;
    text-align: center;
  `,
  scoreValue: `
    font-size: 28px;
    font-weight: bold;
    color: var(--color-fg-default, #c9d1d9);
  `,
  tierBadge: `
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    margin-top: 4px;
    background-color: var(--color-neutral-muted, rgba(110,118,129,0.4));
    color: var(--color-fg-default, #c9d1d9);
  `,
  metricRow: `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 12px;
    color: var(--color-fg-muted, #8b949e);
  `,
  progressTrack: `
    width: 60px;
    height: 6px;
    background-color: var(--color-border-muted, #21262d);
    border-radius: 3px;
    overflow: hidden;
    margin-left: 8px;
  `,
  redFlagBanner: `
    display: none;
    background-color: var(--color-danger-subtle, rgba(255,129,130,0.1));
    color: var(--color-danger-fg, #ff7b72);
    border: 1px solid var(--color-danger-emphasis, #f85149);
    border-radius: 6px;
    padding: 8px;
    margin-top: 8px;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
  `,
};

// ─── Clipboard SVG icon ──────────────────────────────────────────────────────

const COPY_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;

const CHECK_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`;

// ─── Card builder ────────────────────────────────────────────────────────────

const createIntegrityCard = (isFloating = false) => {
  const card = document.createElement('div');
  card.id = INTEGRITY_CARD_ID;
  card.className = isFloating ? '' : 'BorderGrid-row';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'GitHub Integrity Guard Scorecard');
  card.setAttribute('tabindex', '0'); // Added for direct NVDA focus via Tab
  card.setAttribute('aria-live', 'polite');
  card.style.cssText = isFloating ? CARD_STYLES.floating : CARD_STYLES.wrapper;

  const closeBtnHtml = isFloating
    ? `<button data-ig-close style="${CARD_STYLES.closeBtn}" aria-label="Close Integrity Score" title="Close">✕</button>`
    : '';

  card.innerHTML = `
    <div class="BorderGrid-cell">
      <h2 class="h4 mb-2 d-flex flex-justify-between flex-items-center">
        <span>🛡️ Integrity Score</span>
        <span style="display:flex;align-items:center;gap:6px;">
          <button data-ig-copy style="${CARD_STYLES.copyBtn}" aria-label="Copy Trust Score result to clipboard" title="Copy score">${COPY_ICON_SVG}</button>
          <span data-ig-status class="color-fg-muted text-small">Pending</span>
          ${closeBtnHtml}
        </span>
      </h2>

      <div style="${CARD_STYLES.scoreBox}">
        <span data-ig-score style="${CARD_STYLES.scoreValue}">--/100</span>
        <p data-ig-label class="text-small color-fg-muted mt-1 mb-0">Analyzing repository health…</p>
        <span data-ig-tier style="${CARD_STYLES.tierBadge}; display:none;"></span>
      </div>

      <div data-ig-breakdown style="margin-top: 10px; display: none;">
        <div style="${CARD_STYLES.metricRow}"><span>Forks / Stars</span><div style="display:flex;align-items:center;"><span data-ig-forks-pts></span><div style="${CARD_STYLES.progressTrack}"><div data-ig-forks-bar style="height:100%;border-radius:3px;"></div></div></div></div>
        <div style="${CARD_STYLES.metricRow}"><span>Commit Activity</span><div style="display:flex;align-items:center;"><span data-ig-commits-pts></span><div style="${CARD_STYLES.progressTrack}"><div data-ig-commits-bar style="height:100%;border-radius:3px;"></div></div></div></div>
        <div style="${CARD_STYLES.metricRow}"><span>Issue Health</span><div style="display:flex;align-items:center;"><span data-ig-issues-pts></span><div style="${CARD_STYLES.progressTrack}"><div data-ig-issues-bar style="height:100%;border-radius:3px;"></div></div></div></div>
        <div style="${CARD_STYLES.metricRow}"><span>Discussion</span><div style="display:flex;align-items:center;"><span data-ig-discussion-pts></span><div style="${CARD_STYLES.progressTrack}"><div data-ig-discussion-bar style="height:100%;border-radius:3px;"></div></div></div></div>
      </div>

      <div data-ig-tier-notes style="margin-top:6px;display:none;font-size:11px;color:var(--color-fg-muted);"></div>

      <div data-ig-redflag style="${CARD_STYLES.redFlagBanner}" role="alert">
        ⚠️ Red Flag: Abnormally low fork ratio for a popular repository
      </div>

      <span data-ig-sr-summary class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;"></span>

      <span data-ig-live aria-live="assertive" role="status" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;"></span>
    </div>
  `;

  // Wire close button
  if (isFloating) {
    const closeBtn = card.querySelector('[data-ig-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => card.remove());
  }

  // Wire copy button
  const copyBtn = card.querySelector('[data-ig-copy]');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => handleCopy(card, copyBtn));
  }

  return card;
};

// ─── Copy-to-Clipboard handler ───────────────────────────────────────────────

const handleCopy = async (card, btn) => {
  const srSummary = card.querySelector('[data-ig-sr-summary]');
  const liveRegion = card.querySelector('[data-ig-live]');
  const textToCopy = srSummary ? srSummary.textContent : '';

  if (!textToCopy) return;

  try {
    await navigator.clipboard.writeText(textToCopy);
    // Visual feedback — swap icon
    btn.innerHTML = CHECK_ICON_SVG;
    btn.style.color = 'var(--color-success-fg)';
    btn.style.borderColor = 'var(--color-success-fg)';

    // Announce to screen readers
    if (liveRegion) liveRegion.textContent = 'Score copied to clipboard';

    setTimeout(() => {
      btn.innerHTML = COPY_ICON_SVG;
      btn.style.color = '';
      btn.style.borderColor = '';
      if (liveRegion) liveRegion.textContent = '';
    }, 2000);
  } catch {
    if (liveRegion) liveRegion.textContent = 'Failed to copy score';
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const colorToCssVar = (colorKey) => {
  const map = {
    danger:  'var(--color-danger-fg)',
    warning: 'var(--color-attention-fg)',
    healthy: 'var(--color-success-fg)',
  };
  return map[colorKey] ?? 'var(--color-fg-default)';
};

const fillBar = (bar, points, max, cssColor) => {
  if (typeof points === 'string' || typeof max === 'string') {
    bar.style.width = points === '✓' ? '100%' : '0%';
    bar.style.backgroundColor = points === '✓' ? 'var(--color-success-fg)' : 'var(--color-border-muted)';
    return;
  }
  const pct = max > 0 ? Math.round((points / max) * 100) : 0;
  bar.style.width = `${pct}%`;
  bar.style.backgroundColor = cssColor;
};

// ─── Card updater ────────────────────────────────────────────────────────────

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
  const tierEl      = $('[data-ig-tier]');
  const tierNotesEl = $('[data-ig-tier-notes]');

  // ── Error / simple result (no breakdown) ──
  if (!scoreData.breakdown) {
    if (scoreEl)  scoreEl.textContent = `${scoreData.score}/100`;
    if (labelEl)  labelEl.textContent = scoreData.status || '';
    if (statusEl) statusEl.textContent = 'Error';
    return;
  }

  // ── Rich result ──
  const { score, color, label, redFlag, breakdown, tier, tierNotes = [] } = scoreData;
  const cssColor = colorToCssVar(color);

  if (statusEl) statusEl.textContent = label;

  if (scoreEl) {
    scoreEl.textContent = `${score}/100`;
    scoreEl.style.color = cssColor;
  }

  if (labelEl) labelEl.textContent = `${label} — ${breakdown.forks.note}`;

  // Tier badge
  if (tierEl && tier) {
    tierEl.textContent = `Tier ${tier.tier}: ${tier.name}`;
    tierEl.style.display = 'inline-block';
    tierEl.title = tier.description;
  }

  // Tier notes
  if (tierNotesEl && tierNotes.length > 0) {
    tierNotesEl.style.display = 'block';
    tierNotesEl.textContent = tierNotes.join(' · ');
  }

  // Breakdown section
  if (breakdownEl) {
    breakdownEl.style.display = 'block';

    const forksPts      = $('[data-ig-forks-pts]');
    const forksBar      = $('[data-ig-forks-bar]');
    const commitsPts    = $('[data-ig-commits-pts]');
    const commitsBar    = $('[data-ig-commits-bar]');
    const issuesPts     = $('[data-ig-issues-pts]');
    const issuesBar     = $('[data-ig-issues-bar]');
    const discussionPts = $('[data-ig-discussion-pts]');
    const discussionBar = $('[data-ig-discussion-bar]');

    const renderPts = (pts, max) => typeof pts === 'string' ? pts : `${pts}/${max}`;

    if (forksPts)      forksPts.textContent      = renderPts(breakdown.forks.points, breakdown.forks.max);
    if (forksBar)      fillBar(forksBar,      breakdown.forks.points,      breakdown.forks.max,      cssColor);
    if (commitsPts)    commitsPts.textContent    = renderPts(breakdown.commits.points, breakdown.commits.max);
    if (commitsBar)    fillBar(commitsBar,    breakdown.commits.points,    breakdown.commits.max,    cssColor);
    if (issuesPts)     issuesPts.textContent     = renderPts(breakdown.issues.points, breakdown.issues.max);
    if (issuesBar)     fillBar(issuesBar,     breakdown.issues.points,     breakdown.issues.max,     cssColor);
    if (breakdown.discussion) {
      if (discussionPts) discussionPts.textContent = renderPts(breakdown.discussion.points, breakdown.discussion.max);
      if (discussionBar) fillBar(discussionBar, breakdown.discussion.points, breakdown.discussion.max, cssColor);
    }
  }

  // Red Flag banner
  if (redFlagEl && redFlag) redFlagEl.style.display = 'block';

  // Screen reader summary — tiered narration
  if (srSummary) {
    const parts = [
      `Trust Score: ${score} out of 100, rated ${label}.`,
    ];
    if (tier) {
      parts.push(`Scoring Tier: ${tier.name} (${tier.description}).`);
    }
    if (tierNotes.length > 0) {
      parts.push(`Tier notes: ${tierNotes.join('. ')}.`);
    }

    const fmt = (b) => typeof b.points === 'string' ? b.points : `${b.points} of ${b.max}`;
    parts.push(`Fork to Star ratio scored ${fmt(breakdown.forks)}: ${breakdown.forks.note}.`);
    parts.push(`Commit activity scored ${fmt(breakdown.commits)}: ${breakdown.commits.note}.`);
    parts.push(`Issue health scored ${fmt(breakdown.issues)}: ${breakdown.issues.note}.`);
    if (breakdown.discussion) {
      parts.push(`Discussion depth scored ${fmt(breakdown.discussion)}: ${breakdown.discussion.note}.`);
    }
    if (redFlag) {
      parts.push('Red flag: abnormally low fork ratio for a popular repository.');
    }
    srSummary.textContent = parts.join(' ');
  }
};

// ─── Error display ───────────────────────────────────────────────────────────

const buildErrorDisplay = (error) => {
  if (error.name === 'GitHubApiError') {
    switch (error.status) {
      case 401: return { score: '!', status: 'Invalid token — check Options page' };
      case 403:
      case 429: {
        const retry = error.retryAfter ? ` (resets in ${error.retryAfter}s)` : '';
        return { score: '!', status: `Rate limited${retry}` };
      }
      case 404: return { score: 'N/A', status: 'Repository not found' };
      default:  return { score: '!', status: `API error (${error.status})` };
    }
  }
  return { score: '!', status: 'Unexpected error' };
};

// ─── Smart injection with floating fallback ──────────────────────────────────

const injectCardIntoSidebar = async () => {
  if (document.getElementById(INTEGRITY_CARD_ID)) return;

  const isSmallScreen = window.innerWidth < SMALL_SCREEN_PX;
  const sidebar = isSmallScreen ? null : document.querySelector('.Layout-sidebar');
  const isFloating = !sidebar;
  const card = createIntegrityCard(isFloating);

  if (sidebar) {
    if (sidebar.firstChild) sidebar.insertBefore(card, sidebar.firstChild);
    else sidebar.appendChild(card);
  } else {
    document.body.appendChild(card);
  }

  // Fetch and score
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length < 2) return;

  const [owner, repo] = pathParts;
  const repoFullName = `${owner}/${repo}`;
  const cacheKey = `repo_score_${repoFullName}`;

  try {
    const storageUrl = chrome.runtime.getURL('storage.js');
    const serviceUrl = chrome.runtime.getURL('github-service.js');
    const [StorageUtil, GitHubService] = await Promise.all([
      import(storageUrl),
      import(serviceUrl),
    ]);

    const cached = await StorageUtil.getWithExpiry(cacheKey);
    if (cached) {
      console.log(`[gh-integrity-guard] Cache hit for ${repoFullName}`);
      updateCardWithScore(cached);
      return;
    }

    console.log(`[gh-integrity-guard] Cache miss — fetching data for ${repoFullName}`);
    const repoData = await GitHubService.fetchRepoMetadata(owner, repo);
    const scoreData = GitHubService.calculateTrustScore(repoData);

    await StorageUtil.setWithExpiry(cacheKey, scoreData, 1440);
    updateCardWithScore(scoreData);
  } catch (error) {
    console.error(`[gh-integrity-guard] Failed to process ${repoFullName}:`, error);
    updateCardWithScore(buildErrorDisplay(error));
  }
};

// ─── Initialization ──────────────────────────────────────────────────────────

const init = () => {
  // Attempt immediate injection
  injectCardIntoSidebar();

  // Handle GitHub's client-side navigation (Turbo/Pjax)
  document.addEventListener('turbo:load', injectCardIntoSidebar);
  document.addEventListener('pjax:end', injectCardIntoSidebar);

  // Smart MutationObserver: watches for .Layout-sidebar and injects once found
  let observerTimeout = null;
  const observer = new MutationObserver(() => {
    if (document.getElementById(INTEGRITY_CARD_ID)) return;
    const sidebar = document.querySelector('.Layout-sidebar');
    if (sidebar) {
      clearTimeout(observerTimeout);
      injectCardIntoSidebar();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Floating fallback: if sidebar not found after SIDEBAR_WAIT_MS, force inject
  observerTimeout = setTimeout(() => {
    if (!document.getElementById(INTEGRITY_CARD_ID)) {
      console.log('[gh-integrity-guard] Sidebar not found after timeout — injecting floating card');
      injectCardIntoSidebar();
    }
  }, SIDEBAR_WAIT_MS);
};

init();

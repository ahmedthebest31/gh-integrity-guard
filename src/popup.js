import { getWithExpiry } from './storage.js';

const COLOR_CLASS_MAP = {
  danger:  'c-danger',
  warning: 'c-warning',
  healthy: 'c-healthy',
};

const fmtPts = (pts, max) => (typeof pts === 'string' ? pts : `${pts}/${max}`);

/**
 * Renders the cached score into the popup.
 * @param {Object} scoreData
 */
const renderScore = (scoreData) => {
  const container = document.getElementById('popup-content');
  const { score, color, label, redFlag, breakdown } = scoreData;
  const colorClass = COLOR_CLASS_MAP[color] ?? '';

  let html = `
    <div class="score-box">
      <div class="score-value ${colorClass}">${score}/100</div>
      <div class="score-label">${label}</div>
    </div>
    <div class="metric"><span>Forks / Stars</span><span>${fmtPts(breakdown.forks.points, breakdown.forks.max)}</span></div>
    <div class="metric"><span>Commits (90d)</span><span>${fmtPts(breakdown.commits.points, breakdown.commits.max)}</span></div>
    <div class="metric"><span>Issue Health</span><span>${fmtPts(breakdown.issues.points, breakdown.issues.max)}</span></div>
  `;

  if (breakdown.discussion) {
    html += `<div class="metric"><span>Discussion</span><span>${fmtPts(breakdown.discussion.points, breakdown.discussion.max)}</span></div>`;
  }

  if (redFlag) {
    html += `<div class="red-flag"><span aria-hidden="true">⚠️</span> Red Flag Detected</div>`;
  }

  container.innerHTML = html;
};

/**
 * Initialises the popup by reading the active tab URL and checking the cache.
 */
const init = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const url = new URL(tab.url);
    if (url.hostname !== 'github.com') return;

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return;

    const repoFullName = `${pathParts[0]}/${pathParts[1]}`;
    const cacheKey = `repo_score_${repoFullName}`;

    const cached = await getWithExpiry(cacheKey);
    if (cached && cached.breakdown) {
      renderScore(cached);
    } else {
      document.getElementById('popup-content').innerHTML =
        `<p class="empty">No cached score for <strong>${repoFullName}</strong>. Visit the repo page to analyse it.</p>`;
    }
  } catch (error) {
    console.error('[gh-integrity-guard] Popup error:', error);
  }
};

document.addEventListener('DOMContentLoaded', init);

const optionsLink = document.getElementById('options-link');
if (optionsLink) {
  optionsLink.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

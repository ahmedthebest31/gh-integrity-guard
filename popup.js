import { getWithExpiry } from './storage.js';

const COLOR_MAP = {
  danger:  '#cf222e',
  warning: '#bf8700',
  healthy: '#1a7f37',
};

/**
 * Renders the cached score into the popup.
 * @param {Object} scoreData
 */
const renderScore = (scoreData) => {
  const container = document.getElementById('popup-content');
  const { score, color, label, redFlag, breakdown } = scoreData;
  const hex = COLOR_MAP[color] ?? '#24292f';

  let html = `
    <div class="score-box">
      <div class="score-value" style="color:${hex}">${score}/100</div>
      <div class="score-label">${label}</div>
    </div>
    <div class="metric"><span>Forks / Stars</span><span>${breakdown.forks.points}/${breakdown.forks.max}</span></div>
    <div class="metric"><span>Commits (90d)</span><span>${breakdown.commits.points}/${breakdown.commits.max}</span></div>
    <div class="metric"><span>Issue Health</span><span>${breakdown.issues.points}/${breakdown.issues.max}</span></div>
  `;

  if (breakdown.discussion) {
    html += `<div class="metric"><span>Discussion</span><span>${breakdown.discussion.points}/${breakdown.discussion.max}</span></div>`;
  }

  if (redFlag) {
    html += `<div class="red-flag">⚠️ Red Flag Detected</div>`;
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

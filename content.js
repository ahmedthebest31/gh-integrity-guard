/**
 * @fileoverview Content script for GitHub Integrity Guard.
 * Injects a placeholder Trust Score card into the GitHub repository sidebar.
 */

const INTEGRITY_CARD_ID = 'gh-integrity-guard-card';

/**
 * Creates the DOM element for the Integrity Score card.
 * @returns {HTMLElement} The constructed card element.
 */
const createIntegrityCard = () => {
  const card = document.createElement('div');
  card.id = INTEGRITY_CARD_ID;
  
  // Use GitHub's layout classes and ARIA attributes for accessibility
  card.className = 'BorderGrid-row';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'GitHub Integrity Guard Score');
  card.setAttribute('aria-live', 'polite');

  // Inline styles utilizing GitHub Primer CSS variables for native theme support
  card.style.border = '1px solid var(--color-border-default)';
  card.style.borderRadius = '6px';
  card.style.padding = '16px';
  card.style.marginTop = '16px';
  card.style.marginBottom = '16px';
  card.style.backgroundColor = 'var(--color-canvas-subtle)';
  card.style.color = 'var(--color-fg-default)';

  card.innerHTML = `
    <div class="BorderGrid-cell">
      <h2 class="h4 mb-2 d-flex flex-justify-between flex-items-center">
        <span>🛡️ Integrity Score</span>
        <span class="color-fg-muted text-small">Pending</span>
      </h2>
      <div style="background-color: var(--color-canvas-default); border: 1px solid var(--color-border-muted); border-radius: 6px; padding: 12px; text-align: center;">
        <span style="font-size: 24px; font-weight: bold; color: var(--color-fg-default);">--/100</span>
        <p class="text-small color-fg-muted mt-1 mb-0">Analyzing repository health...</p>
      </div>
    </div>
  `;
  
  return card;
};

/**
 * Updates the UI with the fetched or cached score.
 * @param {Object} scoreData
 */
const updateCardWithScore = (scoreData) => {
  const card = document.getElementById(INTEGRITY_CARD_ID);
  if (!card) return;
  
  const scoreSpan = card.querySelector('span[style*="font-size: 24px"]');
  const statusP = card.querySelector('p');
  const pendingSpan = card.querySelector('.color-fg-muted.text-small');
  
  if (scoreSpan && statusP && pendingSpan) {
    scoreSpan.textContent = `${scoreData.score}/100`;
    statusP.textContent = scoreData.status;
    pendingSpan.textContent = 'Calculated';
    
    // Apply basic color logic based on PRD
    if (scoreData.score < 40) {
      scoreSpan.style.color = 'var(--color-danger-fg)';
    } else if (scoreData.score <= 70) {
      scoreSpan.style.color = 'var(--color-attention-fg)';
    } else {
      scoreSpan.style.color = 'var(--color-success-fg)';
    }
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

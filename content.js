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
 * Simulates fetching data from GitHub.
 * @returns {Promise<Object>}
 */
const fetchGitHubData = async (repoFullName) => {
  // In reality, this would fetch from GitHub API and calculate the score
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ score: Math.floor(Math.random() * 100), status: "Organic Activity" });
    }, 1000);
  });
};

/**
 * Injects the Integrity Score card into the GitHub repository sidebar.
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

  try {
    // Dynamically import the storage module
    const storageUrl = chrome.runtime.getURL('storage.js');
    const StorageUtil = await import(storageUrl);

    // Extract repo full name from URL (e.g., 'owner/repo')
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const repoFullName = `${pathParts[0]}/${pathParts[1]}`;
      const cacheKey = `repo_score_${repoFullName}`;

      // Check local cache using getWithExpiry
      let scoreData = await StorageUtil.getWithExpiry(cacheKey);

      if (scoreData) {
        console.log(`[gh-integrity-guard] Using cached score for ${repoFullName}`);
        updateCardWithScore(scoreData);
      } else {
        console.log(`[gh-integrity-guard] Fetching new score for ${repoFullName}`);
        scoreData = await fetchGitHubData(repoFullName);
        
        // Store in cache with 24h TTL
        await StorageUtil.setWithExpiry(cacheKey, scoreData, 1440);
        updateCardWithScore(scoreData);
      }
    }
  } catch (error) {
    console.error('[gh-integrity-guard] Error processing score:', error);
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

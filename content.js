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
 * Injects the Integrity Score card into the GitHub repository sidebar.
 */
const injectCardIntoSidebar = () => {
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

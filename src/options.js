import { encryptData, getWithExpiry, setWithExpiry } from './storage.js';

const PAT_CACHE_KEY = 'gh_integrity_pat';
const TEN_YEARS_IN_MINUTES = 10 * 365 * 24 * 60; // Long TTL for token
const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new';

const openTokenPage = () => {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: GITHUB_TOKEN_URL });
    return;
  }
  window.open(GITHUB_TOKEN_URL, '_blank', 'noopener,noreferrer');
};

document.addEventListener('DOMContentLoaded', () => {
    const patInput = document.getElementById('pat-input');
    const saveBtn = document.getElementById('save-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const tokenLinkBtn = document.getElementById('token-link-btn');
    const statusMessage = document.getElementById('status-message');
    const form = document.getElementById('options-form');

    if (tokenLinkBtn) tokenLinkBtn.addEventListener('click', openTokenPage);

    /**
     * Displays a status message to the user.
     * @param {string} message - The message to display.
     * @param {string} type - 'success' or 'error'.
     */
    const showStatus = (message, type) => {
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        setTimeout(() => {
            statusMessage.textContent = '';
            statusMessage.className = 'status';
        }, 3000);
    };

    /**
     * Updates the UI based on whether a token is already saved.
     */
    const updateUIState = async () => {
        try {
            const encryptedPat = await getWithExpiry(PAT_CACHE_KEY);
            if (encryptedPat) {
                patInput.value = '************************';
                patInput.disabled = true;
                saveBtn.style.display = 'none';
                deleteBtn.style.display = 'inline-block';
            } else {
                patInput.value = '';
                patInput.disabled = false;
                saveBtn.style.display = 'inline-block';
                deleteBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching token state:', error);
        }
    };

    /**
     * Handles saving the PAT.
     */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = patInput.value.trim();
        
        if (!token) {
            showStatus('Please enter a valid token.', 'error');
            return;
        }

        try {
            const encryptedData = await encryptData(token);
            if (encryptedData) {
                // Save with effectively infinite TTL
                await setWithExpiry(PAT_CACHE_KEY, encryptedData, TEN_YEARS_IN_MINUTES);
                showStatus('Token saved securely.', 'success');
                updateUIState();
            } else {
                showStatus('Failed to encrypt token.', 'error');
            }
        } catch (error) {
            showStatus('An error occurred while saving.', 'error');
            console.error(error);
        }
    });

    /**
     * Handles deleting the PAT.
     */
    deleteBtn.addEventListener('click', async () => {
        try {
            await chrome.storage.local.remove(PAT_CACHE_KEY);
            showStatus('Token deleted.', 'success');
            updateUIState();
        } catch (error) {
            showStatus('Failed to delete token.', 'error');
            console.error(error);
        }
    });

    // Initialize UI on load
    updateUIState();
});

/**
 * @fileoverview GitHub API service module.
 * Handles all authenticated/unauthenticated requests to the GitHub REST API.
 * Exports fetchRepoMetadata() for use by the content script.
 */

import { getWithExpiry, decryptData } from './storage.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com';
const PAT_CACHE_KEY = 'gh_integrity_pat';

// ─── Custom Error Types ─────────────────────────────────────────────────────

/**
 * Represents a structured GitHub API error with status code and retry metadata.
 */
class GitHubApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status - HTTP status code.
   * @param {number|null} retryAfter - Seconds until rate limit resets (if applicable).
   */
  constructor(message, status, retryAfter = null) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Retrieves and decrypts the stored PAT, if one exists.
 * @returns {Promise<string|null>} The plaintext token, or null.
 */
const getAuthToken = async () => {
  try {
    const encryptedPat = await getWithExpiry(PAT_CACHE_KEY);
    if (!encryptedPat) return null;
    return await decryptData(encryptedPat);
  } catch (error) {
    console.warn('[gh-integrity-guard] Could not retrieve PAT, falling back to unauthenticated requests.', error);
    return null;
  }
};

/**
 * Builds common request headers, optionally including an Authorization header.
 * @param {string|null} token
 * @returns {HeadersInit}
 */
const buildHeaders = (token) => {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  return headers;
};

/**
 * Parses rate-limit reset information from response headers.
 * @param {Headers} headers
 * @returns {number|null} Seconds until rate-limit reset, or null.
 */
const parseRetryAfter = (headers) => {
  const resetTimestamp = headers.get('x-ratelimit-reset');
  if (resetTimestamp) {
    const resetDate = new Date(parseInt(resetTimestamp, 10) * 1000);
    const secondsUntilReset = Math.max(0, Math.ceil((resetDate - Date.now()) / 1000));
    return secondsUntilReset;
  }
  return null;
};

/**
 * Performs a single fetch against the GitHub API with structured error handling.
 * @param {string} endpoint - API path (e.g. `/repos/owner/repo`).
 * @param {string|null} token - Optional PAT.
 * @returns {Promise<any>} Parsed JSON body.
 * @throws {GitHubApiError}
 */
const request = async (endpoint, token) => {
  const url = `${GITHUB_API}${endpoint}`;
  const headers = buildHeaders(token);

  const response = await fetch(url, { headers });

  if (response.ok) {
    return await response.json();
  }

  // ── Rate Limit (403 / 429) ──
  if (response.status === 403 || response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers);
    const retryMsg = retryAfter !== null ? ` Resets in ${retryAfter}s.` : '';
    throw new GitHubApiError(
      `Rate limit exceeded.${retryMsg}`,
      response.status,
      retryAfter,
    );
  }

  // ── Unauthorized (401) ──
  if (response.status === 401) {
    throw new GitHubApiError(
      'Unauthorized — your Personal Access Token may be invalid or expired.',
      401,
    );
  }

  // ── Not Found (404) ──
  if (response.status === 404) {
    throw new GitHubApiError(
      'Repository not found — it may be private or deleted.',
      404,
    );
  }

  // ── Catch-all ──
  throw new GitHubApiError(
    `Unexpected API response (${response.status}).`,
    response.status,
  );
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetches all repository metadata required by the scoring algorithm.
 *
 * Makes three parallel-where-possible requests:
 *   1. GET /repos/:owner/:repo          → stars, forks, watchers, open_issues
 *   2. GET /repos/:owner/:repo/commits  → recent commit count (last 90 days)
 *   3. GET /search/issues               → closed issue count
 *
 * @param {string} owner - Repository owner (user or org).
 * @param {string} repo  - Repository name.
 * @returns {Promise<Object>} Aggregated metadata object.
 * @throws {GitHubApiError} On any HTTP-level failure.
 */
export const fetchRepoMetadata = async (owner, repo) => {
  const token = await getAuthToken();

  // Build the date boundary for the 90-day commit window
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const sinceISO = ninetyDaysAgo.toISOString();

  // Fire all three requests concurrently to minimise latency
  const [repoInfo, recentCommits, closedIssuesResult] = await Promise.all([
    request(`/repos/${owner}/${repo}`, token),
    request(`/repos/${owner}/${repo}/commits?since=${sinceISO}&per_page=100`, token),
    request(`/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed&per_page=1`, token),
  ]);

  return {
    owner,
    repo,
    stars: repoInfo.stargazers_count ?? 0,
    forks: repoInfo.forks_count ?? 0,
    watchers: repoInfo.subscribers_count ?? repoInfo.watchers_count ?? 0,
    openIssues: repoInfo.open_issues_count ?? 0,
    closedIssues: closedIssuesResult.total_count ?? 0,
    recentCommitsCount: Array.isArray(recentCommits) ? recentCommits.length : 0,
  };
};

/**
 * Placeholder — will contain the weighted scoring algorithm defined in the PRD.
 * Kept here as a pure function that receives data and returns a score object.
 *
 * @param {Object} data - The metadata object returned by fetchRepoMetadata.
 * @returns {{ score: number|string, status: string }}
 */
export const calculateTrustScore = (data) => {
  // TODO: implement weighted scoring (fork-to-star 40%, commits 30%, issues 30%)
  return { score: '--', status: 'Score calculation pending' };
};

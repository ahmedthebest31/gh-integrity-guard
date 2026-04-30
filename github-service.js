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
 * Makes parallel requests:
 *   1. GET /repos/:owner/:repo          → stars, forks, watchers, open_issues
 *   2. GET /repos/:owner/:repo/commits  → recent commit count (last 90 days)
 *   3. GET /search/issues               → closed issue count
 *   4. GET /repos/:owner/:repo/issues   → recent issues with comment counts
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

  // Fire all requests concurrently to minimise latency
  const [repoInfo, recentCommits, closedIssuesResult, recentIssues] = await Promise.all([
    request(`/repos/${owner}/${repo}`, token),
    request(`/repos/${owner}/${repo}/commits?since=${sinceISO}&per_page=100`, token),
    request(`/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed&per_page=1`, token),
    request(`/repos/${owner}/${repo}/issues?state=all&sort=updated&per_page=30`, token),
  ]);

  // Calculate average comments per issue from the 30 most recently updated
  const issueList = Array.isArray(recentIssues) ? recentIssues : [];
  const totalComments = issueList.reduce((sum, issue) => sum + (issue.comments ?? 0), 0);
  const avgCommentsPerIssue = issueList.length > 0 ? totalComments / issueList.length : 0;

  return {
    owner,
    repo,
    stars: repoInfo.stargazers_count ?? 0,
    forks: repoInfo.forks_count ?? 0,
    watchers: repoInfo.subscribers_count ?? repoInfo.watchers_count ?? 0,
    openIssues: repoInfo.open_issues_count ?? 0,
    closedIssues: closedIssuesResult.total_count ?? 0,
    recentCommitsCount: Array.isArray(recentCommits) ? recentCommits.length : 0,
    avgCommentsPerIssue,
  };
};

// ─── Scoring Constants ───────────────────────────────────────────────────────

const WEIGHT_FORKS = 40;
const WEIGHT_COMMITS = 30;
const WEIGHT_ISSUES = 30;
const BONUS_DISCUSSION = 10;

const RED_FLAG_STAR_THRESHOLD = 10000;
const RED_FLAG_RATIO_CEILING = 0.03;
const RED_FLAG_MAX_SCORE = 30;

// ─── Individual Metric Scorers ───────────────────────────────────────────────

/**
 * Scores the fork-to-star ratio (max 40 pts).
 *
 * Rationale:
 *   ratio = forks / stars
 *   - ratio ≥ 0.20  → full 40 pts  (healthy organic engagement)
 *   - ratio < 0.05  → (ratio / 0.05) * 40 − 20 penalty  (suspiciously low)
 *   - else           → linear scale between 0.05 and 0.20
 *
 * @param {number} stars
 * @param {number} forks
 * @returns {{ points: number, ratio: number, note: string }}
 */
const scoreForkToStar = (stars, forks) => {
  if (stars === 0) {
    return { points: 0, ratio: 0, note: 'No stars — cannot evaluate ratio' };
  }

  const ratio = forks / stars;

  // Healthy ratio (≥ 20%)
  if (ratio >= 0.20) {
    return { points: WEIGHT_FORKS, ratio, note: 'Healthy organic fork engagement' };
  }

  // Suspiciously low ratio (< 5%)
  if (ratio < 0.05) {
    const base = (ratio / 0.05) * WEIGHT_FORKS;
    const penalised = Math.max(0, base - 20);
    return { points: Math.round(penalised), ratio, note: 'Very low fork ratio — possible fake stars' };
  }

  // Linear interpolation for 0.05 ≤ ratio < 0.20
  const normalised = (ratio - 0.05) / (0.20 - 0.05);
  const points = Math.round(normalised * WEIGHT_FORKS);
  return { points, ratio, note: 'Moderate fork engagement' };
};

/**
 * Scores recent commit activity (max 30 pts).
 *
 * Uses the total commit count from the last 90 days as a proxy:
 *   - ≥ 30 commits → full 30 pts  (≈ 1+ per week across 4+ weeks)
 *   - 0 commits    → 0 pts        (dead/abandoned)
 *   - else          → linear scale
 *
 * @param {number} recentCommitsCount
 * @returns {{ points: number, count: number, note: string }}
 */
const scoreCommitActivity = (recentCommitsCount) => {
  if (recentCommitsCount === 0) {
    return { points: 0, count: 0, note: 'No commits in the last 90 days — possibly abandoned' };
  }

  if (recentCommitsCount >= 30) {
    return { points: WEIGHT_COMMITS, count: recentCommitsCount, note: 'Active development' };
  }

  const points = Math.round((recentCommitsCount / 30) * WEIGHT_COMMITS);
  return { points, count: recentCommitsCount, note: 'Low to moderate commit activity' };
};

/**
 * Scores issue resolution health (max 30 pts).
 *
 * closedRatio = closed / (open + closed)
 *   - ≥ 70% closed → full 30 pts
 *   - 0 total       → 15 pts (neutral — many repos have no issues)
 *   - else          → linear scale
 *
 * @param {number} openIssues
 * @param {number} closedIssues
 * @returns {{ points: number, closedRatio: number, note: string }}
 */
const scoreIssueHealth = (openIssues, closedIssues) => {
  const total = openIssues + closedIssues;

  if (total === 0) {
    return { points: 15, closedRatio: 0, note: 'No issues tracked — neutral score' };
  }

  const closedRatio = closedIssues / total;

  if (closedRatio >= 0.70) {
    return { points: WEIGHT_ISSUES, closedRatio, note: 'Strong issue resolution' };
  }

  const points = Math.round((closedRatio / 0.70) * WEIGHT_ISSUES);
  return { points, closedRatio, note: 'Below-average issue resolution' };
};

/**
 * Scores issue discussion depth (bonus up to 10 pts).
 *
 * Rationale:
 *   avgComments = total comments across 30 recent issues / issue count
 *   - avgComments ≥ 3  → full 10 pts  (active, engaged community)
 *   - avgComments = 0  → 0 pts
 *   - else             → linear scale
 *
 * This bonus rewards repos where issues generate real discussion,
 * regardless of whether those issues are open or closed.
 *
 * @param {number} avgCommentsPerIssue
 * @returns {{ points: number, avg: number, note: string }}
 */
const scoreDiscussionDepth = (avgCommentsPerIssue) => {
  if (avgCommentsPerIssue === 0) {
    return { points: 0, avg: 0, note: 'No issue discussion detected' };
  }

  if (avgCommentsPerIssue >= 3) {
    return { points: BONUS_DISCUSSION, avg: avgCommentsPerIssue, note: 'Active community discussion' };
  }

  const points = Math.round((avgCommentsPerIssue / 3) * BONUS_DISCUSSION);
  return { points, avg: avgCommentsPerIssue, note: 'Some community engagement' };
};

/**
 * Maps a numeric score to a PRD-defined color and human label.
 * @param {number} score
 * @returns {{ color: string, label: string }}
 */
const mapScoreToColor = (score) => {
  if (score < 40)  return { color: 'danger',    label: 'Danger'  };
  if (score <= 70) return { color: 'warning',   label: 'Warning' };
  return               { color: 'healthy',  label: 'Healthy' };
};

// ─── Public Scoring Function ─────────────────────────────────────────────────

/**
 * Calculates the Trust Score (0-100) from repository metadata.
 *
 * Core Weights (100 pts max):
 *   Fork-to-Star Ratio  — 40 pts
 *   Commit Activity      — 30 pts
 *   Issue Resolution     — 30 pts
 *
 * Bonus (up to +10 pts, clamped to 100):
 *   Discussion Depth     — 10 pts
 *
 * Red Flag:
 *   If stars > 10 000 AND (forks / stars) < 3 %, the final score is capped
 *   at 30 regardless of other metrics (Danger Zone).
 *
 * @param {Object} data - The metadata object returned by fetchRepoMetadata.
 * @returns {{ score: number, color: string, label: string, breakdown: Object }}
 */
export const calculateTrustScore = (data) => {
  const { stars, forks, recentCommitsCount, openIssues, closedIssues, avgCommentsPerIssue = 0 } = data;

  // ── Individual metric scores ──
  const forkScore       = scoreForkToStar(stars, forks);
  const commitScore     = scoreCommitActivity(recentCommitsCount);
  const issueScore      = scoreIssueHealth(openIssues, closedIssues);
  const discussionScore = scoreDiscussionDepth(avgCommentsPerIssue);

  let totalScore = forkScore.points + commitScore.points + issueScore.points + discussionScore.points;

  // ── Red Flag detection ──
  let redFlag = false;
  if (stars > RED_FLAG_STAR_THRESHOLD && (stars === 0 ? 0 : forks / stars) < RED_FLAG_RATIO_CEILING) {
    redFlag = true;
    totalScore = Math.min(totalScore, RED_FLAG_MAX_SCORE);
  }

  // Clamp to 0-100
  totalScore = Math.max(0, Math.min(100, totalScore));

  const { color, label } = mapScoreToColor(totalScore);

  return {
    score: totalScore,
    color,
    label,
    redFlag,
    breakdown: {
      forks:      { points: forkScore.points,       max: WEIGHT_FORKS,      ratio: forkScore.ratio,              note: forkScore.note       },
      commits:    { points: commitScore.points,      max: WEIGHT_COMMITS,    count: commitScore.count,             note: commitScore.note     },
      issues:     { points: issueScore.points,       max: WEIGHT_ISSUES,     closedRatio: issueScore.closedRatio,  note: issueScore.note      },
      discussion: { points: discussionScore.points,  max: BONUS_DISCUSSION,  avg: discussionScore.avg,             note: discussionScore.note },
    },
  };
};

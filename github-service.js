/**
 * @fileoverview GitHub API service module.
 * Handles all authenticated/unauthenticated requests to the GitHub REST API.
 * Exports fetchRepoMetadata() and calculateTrustScore() for use by the content script.
 *
 * Scoring uses a Tiered System based on star count:
 *   Tier 1 (Incubator):    < 200 stars   — highly trusted baseline (90+)
 *   Tier 2 (Growth):       200 – 5,000   — pulse-focused, relaxed ratios
 *   Tier 3 (Established):  5,000 – 10,000 — moderate auditing
 *   Tier 4 (High-Traffic): > 10,000      — full strict audit
 */

import { getWithExpiry, decryptData } from './storage.js';

const GITHUB_API = 'https://api.github.com';
const PAT_CACHE_KEY = 'gh_integrity_pat';

class GitHubApiError extends Error {
  constructor(message, status, { retryAfter = null, authenticated = false } = {}) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.authenticated = authenticated;
  }
}

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

const buildHeaders = (token) => {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;
  return headers;
};

const parseRetryAfter = (headers) => {
  const resetTimestamp = headers.get('x-ratelimit-reset');
  if (resetTimestamp) {
    const resetDate = new Date(parseInt(resetTimestamp, 10) * 1000);
    return Math.max(0, Math.ceil((resetDate - Date.now()) / 1000));
  }
  return null;
};

const request = async (endpoint, token) => {
  const url = `${GITHUB_API}${endpoint}`;
  const response = await fetch(url, { headers: buildHeaders(token) });
  const authenticated = Boolean(token);

  if (response.ok) return await response.json();

  if (response.status === 403 || response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers);
    const retryMsg = retryAfter !== null ? ` Resets in ${retryAfter}s.` : '';
    throw new GitHubApiError(`Rate limit exceeded.${retryMsg}`, response.status, { retryAfter, authenticated });
  }
  if (response.status === 401) throw new GitHubApiError('Unauthorized — your Personal Access Token may be invalid or expired.', 401, { authenticated });
  if (response.status === 404) throw new GitHubApiError('Repository not found — it may be private or deleted.', 404, { authenticated });
  throw new GitHubApiError(`Unexpected API response (${response.status}).`, response.status, { authenticated });
};

// ─── Closed-issue count ───────────────────────────────────────────────────────

/**
 * Counts closed issues via the Search API (excludes pull requests).
 * @returns {Promise<number>}
 */
const countClosedIssuesViaSearch = async (owner, repo, token) => {
  const result = await request(`/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed&per_page=1`, token);
  return result.total_count ?? 0;
};

/**
 * Fallback count for closed issues via issue-list pagination.
 * Uses the `Link` header `rel="last"` page number with per_page=1.
 * Note: this path also counts pull requests; it is a degraded fallback only.
 * @returns {Promise<number>}
 */
const countClosedIssuesViaIssueList = async (owner, repo, token) => {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/issues?state=closed&per_page=1`;
  const response = await fetch(url, { headers: buildHeaders(token) });
  if (!response.ok) {
    throw new GitHubApiError(`Issue list request failed (${response.status}).`, response.status, { authenticated: Boolean(token) });
  }
  const body = await response.json();
  if (!Array.isArray(body) || body.length === 0) return 0;
  const link = response.headers.get('link') || '';
  const lastMatch = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return lastMatch ? parseInt(lastMatch[1], 10) : body.length;
};

/**
 * Counts closed issues, preferring the Search API and falling back to
 * issue-list pagination. The Search API has its own rate-limit bucket, so a
 * search quota hit must not kill the whole audit.
 * @returns {Promise<number>}
 */
const countClosedIssues = async (owner, repo, token) => {
  try {
    return await countClosedIssuesViaSearch(owner, repo, token);
  } catch (searchError) {
    console.warn('[gh-integrity-guard] Search API unavailable, falling back to issue-list pagination.', searchError);
    return await countClosedIssuesViaIssueList(owner, repo, token);
  }
};

// ─── Public API ──────────────────────────────────────────────────────────────

export const fetchRepoMetadata = async (owner, repo) => {
  const token = await getAuthToken();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const sinceISO = ninetyDaysAgo.toISOString();

  const [repoInfo, recentCommits, closedIssues, recentIssues] = await Promise.all([
    request(`/repos/${owner}/${repo}`, token),
    request(`/repos/${owner}/${repo}/commits?since=${sinceISO}&per_page=100`, token),
    countClosedIssues(owner, repo, token),
    request(`/repos/${owner}/${repo}/issues?state=all&sort=updated&per_page=30`, token),
  ]);

  const issueList = Array.isArray(recentIssues) ? recentIssues : [];
  const totalComments = issueList.reduce((sum, issue) => sum + (issue.comments ?? 0), 0);
  const avgCommentsPerIssue = issueList.length > 0 ? totalComments / issueList.length : 0;

  const pushedAt = repoInfo.pushed_at ? new Date(repoInfo.pushed_at) : null;
  const daysSinceLastPush = pushedAt
    ? Math.floor((Date.now() - pushedAt.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  return {
    owner, repo,
    stars: repoInfo.stargazers_count ?? 0,
    forks: repoInfo.forks_count ?? 0,
    watchers: repoInfo.subscribers_count ?? repoInfo.watchers_count ?? 0,
    openIssues: repoInfo.open_issues_count ?? 0,
    closedIssues,
    recentCommitsCount: Array.isArray(recentCommits) ? recentCommits.length : 0,
    avgCommentsPerIssue,
    size: repoInfo.size ?? 0,
    daysSinceLastPush,
  };
};

// ─── Tier Definitions ────────────────────────────────────────────────────────

const determineTier = (stars) => {
  if (stars < 200) return { tier: 1, name: 'Incubator', description: 'Small / new project — highly trusted by default' };
  if (stars < 5000) return { tier: 2, name: 'Growth', description: 'Growing project — pulse metrics focused' };
  if (stars < 10000) return { tier: 3, name: 'Established', description: 'Established project — moderate auditing' };
  return { tier: 4, name: 'High-Traffic', description: 'Popular project — full strict audit' };
};

// ─── Tier 1 (Incubator): < 200 stars ────────────────────────────────────────
const scoreTier1 = (data) => {
  const { recentCommitsCount, size, daysSinceLastPush, avgCommentsPerIssue = 0 } = data;
  let score = 92;
  const notes = [];

  const isEmpty = size === 0 && recentCommitsCount === 0;
  if (isEmpty) { score = 40; notes.push('Repository appears empty (no files or commits)'); }

  const isDormant = daysSinceLastPush > 365;
  if (isDormant && !isEmpty) { score = Math.max(70, score - 20); notes.push('No activity for over a year'); }

  if (recentCommitsCount > 0 && !isEmpty) {
    score = Math.min(100, score + Math.min(8, Math.round(recentCommitsCount / 3)));
    notes.push('Active recent development');
  }
  if (notes.length === 0) notes.push('Small project — trusted by default');

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      forks:      { points: '-', max: '-', ratio: '-', note: 'Not audited at Incubator tier' },
      commits:    { points: recentCommitsCount > 0 ? '✓' : '✗', max: '-', count: recentCommitsCount, note: recentCommitsCount > 0 ? 'Has recent commits' : 'No recent commits' },
      issues:     { points: '-', max: '-', closedRatio: '-', note: 'Not audited at Incubator tier' },
      discussion: { points: '-', max: '-', avg: avgCommentsPerIssue, note: 'Not audited at Incubator tier' },
    },
    notes,
  };
};

// ─── Tier 2 (Growth): 200 – 5,000 stars ─────────────────────────────────────
const scoreTier2 = (data) => {
  const { stars, forks, recentCommitsCount, openIssues, closedIssues, avgCommentsPerIssue = 0 } = data;
  const W = { pulse: 40, issues: 30, forks: 20, disc: 10 };

  // Pulse (commits — primary)
  let pulse = { pts: 0, note: '' };
  if (recentCommitsCount >= 20) pulse = { pts: W.pulse, note: 'Strong recent activity' };
  else if (recentCommitsCount === 0) pulse = { pts: 0, note: 'No commits in 90 days' };
  else pulse = { pts: Math.round((recentCommitsCount / 20) * W.pulse), note: 'Moderate activity' };

  // Issues
  const total = openIssues + closedIssues;
  let iss = { pts: 0, note: '', cr: 0 };
  if (total === 0) iss = { pts: Math.round(W.issues * 0.5), note: 'No issues — neutral', cr: 0 };
  else { iss.cr = closedIssues / total; iss.pts = iss.cr >= 0.60 ? W.issues : Math.round((iss.cr / 0.60) * W.issues); iss.note = iss.cr >= 0.60 ? 'Good resolution' : 'Below-average resolution'; }

  // Forks (relaxed)
  let fk = { pts: 0, note: '', r: 0 };
  if (stars === 0) fk = { pts: 0, note: 'No stars', r: 0 };
  else { fk.r = forks / stars; if (fk.r >= 0.10) fk = { ...fk, pts: W.forks, note: 'Healthy fork engagement' }; else if (fk.r < 0.02) fk = { ...fk, pts: Math.round((fk.r / 0.02) * W.forks * 0.5), note: 'Low fork ratio — monitor' }; else { const n = (fk.r - 0.02) / 0.08; fk = { ...fk, pts: Math.round(n * W.forks), note: 'Moderate fork engagement' }; } }

  // Discussion
  let disc = { pts: 0, note: '' };
  if (avgCommentsPerIssue >= 3) disc = { pts: W.disc, note: 'Active discussion' };
  else if (avgCommentsPerIssue === 0) disc = { pts: 0, note: 'No discussion' };
  else disc = { pts: Math.round((avgCommentsPerIssue / 3) * W.disc), note: 'Some engagement' };

  return {
    score: Math.max(0, Math.min(100, pulse.pts + iss.pts + fk.pts + disc.pts)),
    breakdown: {
      forks:      { points: fk.pts, max: W.forks, ratio: fk.r, note: fk.note },
      commits:    { points: pulse.pts, max: W.pulse, count: recentCommitsCount, note: pulse.note },
      issues:     { points: iss.pts, max: W.issues, closedRatio: iss.cr, note: iss.note },
      discussion: { points: disc.pts, max: W.disc, avg: avgCommentsPerIssue, note: disc.note },
    },
    notes: [],
  };
};

// ─── Tier 3 (Established): 5,000 – 10,000 stars ─────────────────────────────
const scoreTier3 = (data) => {
  const { stars, forks, recentCommitsCount, openIssues, closedIssues, avgCommentsPerIssue = 0 } = data;
  const W = { forks: 30, commits: 30, issues: 30, disc: 10 };

  // Forks (moderate)
  let fk = { pts: 0, note: '', r: 0 };
  if (stars === 0) fk.note = 'No stars';
  else { fk.r = forks / stars; if (fk.r >= 0.15) fk = { ...fk, pts: W.forks, note: 'Healthy fork engagement' }; else if (fk.r < 0.04) fk = { ...fk, pts: Math.max(0, Math.round((fk.r / 0.04) * W.forks - 10)), note: 'Low fork ratio — possible inflated stars' }; else { const n = (fk.r - 0.04) / 0.11; fk = { ...fk, pts: Math.round(n * W.forks), note: 'Moderate fork engagement' }; } }

  // Commits
  let cm = { pts: 0, note: '' };
  if (recentCommitsCount >= 30) cm = { pts: W.commits, note: 'Active development' };
  else if (recentCommitsCount === 0) cm = { pts: 0, note: 'No commits in 90 days — possibly abandoned' };
  else cm = { pts: Math.round((recentCommitsCount / 30) * W.commits), note: 'Low to moderate activity' };

  // Issues
  const total = openIssues + closedIssues;
  let iss = { pts: 0, note: '', cr: 0 };
  if (total === 0) iss = { pts: 15, note: 'No issues — neutral', cr: 0 };
  else { iss.cr = closedIssues / total; iss.pts = iss.cr >= 0.65 ? W.issues : Math.round((iss.cr / 0.65) * W.issues); iss.note = iss.cr >= 0.65 ? 'Strong issue resolution' : 'Below-average resolution'; }

  // Discussion
  let disc = { pts: 0, note: '' };
  if (avgCommentsPerIssue >= 3) disc = { pts: W.disc, note: 'Active discussion' };
  else if (avgCommentsPerIssue === 0) disc = { pts: 0, note: 'No discussion' };
  else disc = { pts: Math.round((avgCommentsPerIssue / 3) * W.disc), note: 'Some engagement' };

  return {
    score: Math.max(0, Math.min(100, fk.pts + cm.pts + iss.pts + disc.pts)),
    breakdown: {
      forks:      { points: fk.pts, max: W.forks, ratio: fk.r, note: fk.note },
      commits:    { points: cm.pts, max: W.commits, count: recentCommitsCount, note: cm.note },
      issues:     { points: iss.pts, max: W.issues, closedRatio: iss.cr, note: iss.note },
      discussion: { points: disc.pts, max: W.disc, avg: avgCommentsPerIssue, note: disc.note },
    },
    notes: [],
  };
};

// ─── Tier 4 (High-Traffic): > 10,000 stars ──────────────────────────────────
const scoreTier4 = (data) => {
  const { stars, forks, recentCommitsCount, openIssues, closedIssues, avgCommentsPerIssue = 0 } = data;
  const W = { forks: 40, commits: 30, issues: 30, disc: 10 };
  const RF_CEIL = 0.03, RF_MAX = 30;

  // Forks (strict)
  let fk = { pts: 0, note: '', r: 0 };
  if (stars === 0) fk.note = 'No stars';
  else {
    fk.r = forks / stars;
    if (fk.r >= 0.20) fk = { ...fk, pts: W.forks, note: 'Healthy organic fork engagement' };
    else if (fk.r < 0.05) fk = { ...fk, pts: Math.max(0, Math.round((fk.r / 0.05) * W.forks - 20)), note: 'Very low fork ratio — possible fake stars' };
    else { const n = (fk.r - 0.05) / 0.15; fk = { ...fk, pts: Math.round(n * W.forks), note: 'Moderate fork engagement' }; }
  }

  // Commits
  let cm = { pts: 0, note: '' };
  if (recentCommitsCount >= 30) cm = { pts: W.commits, note: 'Active development' };
  else if (recentCommitsCount === 0) cm = { pts: 0, note: 'No commits in 90 days — possibly abandoned' };
  else cm = { pts: Math.round((recentCommitsCount / 30) * W.commits), note: 'Low to moderate commit activity' };

  // Issues
  const total = openIssues + closedIssues;
  let iss = { pts: 0, note: '', cr: 0 };
  if (total === 0) iss = { pts: 15, note: 'No issues — neutral', cr: 0 };
  else { iss.cr = closedIssues / total; iss.pts = iss.cr >= 0.70 ? W.issues : Math.round((iss.cr / 0.70) * W.issues); iss.note = iss.cr >= 0.70 ? 'Strong issue resolution' : 'Below-average resolution'; }

  // Discussion
  let disc = { pts: 0, note: '' };
  if (avgCommentsPerIssue >= 3) disc = { pts: W.disc, note: 'Active community discussion' };
  else if (avgCommentsPerIssue === 0) disc = { pts: 0, note: 'No discussion detected' };
  else disc = { pts: Math.round((avgCommentsPerIssue / 3) * W.disc), note: 'Some community engagement' };

  let totalScore = fk.pts + cm.pts + iss.pts + disc.pts;
  let redFlag = false;
  if (stars > 0 && fk.r < RF_CEIL) { redFlag = true; totalScore = Math.min(totalScore, RF_MAX); }
  totalScore = Math.max(0, Math.min(100, totalScore));

  return {
    score: totalScore, redFlag,
    breakdown: {
      forks:      { points: fk.pts, max: W.forks, ratio: fk.r, note: fk.note },
      commits:    { points: cm.pts, max: W.commits, count: recentCommitsCount, note: cm.note },
      issues:     { points: iss.pts, max: W.issues, closedRatio: iss.cr, note: iss.note },
      discussion: { points: disc.pts, max: W.disc, avg: avgCommentsPerIssue, note: disc.note },
    },
    notes: [],
  };
};

// ─── Score Color Mapping ─────────────────────────────────────────────────────

const mapScoreToColor = (score) => {
  if (score < 40)  return { color: 'danger',  label: 'Danger'  };
  if (score <= 70) return { color: 'warning', label: 'Warning' };
  return             { color: 'healthy', label: 'Healthy' };
};

// ─── Public Scoring Function ─────────────────────────────────────────────────

/**
 * Calculates the Trust Score (0-100) using the Dynamic Tiered Scoring System.
 * @param {Object} data - The metadata object returned by fetchRepoMetadata.
 * @returns {Object} Score result with tier info, breakdown, and color.
 */
export const calculateTrustScore = (data) => {
  const tierInfo = determineTier(data.stars);
  let result;
  switch (tierInfo.tier) {
    case 1: result = scoreTier1(data); break;
    case 2: result = scoreTier2(data); break;
    case 3: result = scoreTier3(data); break;
    default: result = scoreTier4(data); break;
  }
  const { color, label } = mapScoreToColor(result.score);
  return {
    score: result.score, color, label,
    tier: tierInfo,
    redFlag: result.redFlag || false,
    breakdown: result.breakdown,
    tierNotes: result.notes || [],
  };
};

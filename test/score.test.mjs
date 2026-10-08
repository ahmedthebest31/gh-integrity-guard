const { calculateTrustScore } = await import('./github-service.mjs');

const base = {
  stars: 0, forks: 0, watchers: 0, openIssues: 0, closedIssues: 0,
  recentCommitsCount: 0, avgCommentsPerIssue: 0, size: 0, daysSinceLastPush: 0,
};

const cases = [
  ['T1 active small',      {...base, stars: 50,  size: 400, recentCommitsCount: 12, daysSinceLastPush: 3}],
  ['T1 empty',             {...base, stars: 10,  size: 0,   recentCommitsCount: 0,  daysSinceLastPush: 400}],
  ['T1 dormant',           {...base, stars: 100, size: 800, recentCommitsCount: 0,  daysSinceLastPush: 400}],
  ['T1 boundary 199',      {...base, stars: 199}],
  ['T2 boundary 200',      {...base, stars: 200, forks: 20, size: 100, recentCommitsCount: 30, openIssues: 1, closedIssues: 9, avgCommentsPerIssue: 4}],
  ['T2 excellent',         {...base, stars: 2000, forks: 300, size: 900, recentCommitsCount: 40, openIssues: 5, closedIssues: 20, avgCommentsPerIssue: 4}],
  ['T2 terrible',          {...base, stars: 2500, forks: 12, size: 900, recentCommitsCount: 0, openIssues: 30, closedIssues: 0, avgCommentsPerIssue: 0}],
  ['T2 zero issues',       {...base, stars: 1500, forks: 150, size: 900, recentCommitsCount: 25, openIssues: 0, closedIssues: 0, avgCommentsPerIssue: 0}],
  ['T2 fork@0.0199',       {...base, stars: 1000, forks: 19, size: 500, recentCommitsCount: 25, openIssues: 2, closedIssues: 8, avgCommentsPerIssue: 1}],
  ['T2 fork@0.02',         {...base, stars: 1000, forks: 20, size: 500, recentCommitsCount: 25, openIssues: 2, closedIssues: 8, avgCommentsPerIssue: 1}],
  ['T3 boundary 5000',     {...base, stars: 5000, forks: 100, size: 900, recentCommitsCount: 30, openIssues: 3, closedIssues: 7, avgCommentsPerIssue: 1}],
  ['T3 fork@0.0399',       {...base, stars: 6000, forks: 239, size: 900, recentCommitsCount: 40, openIssues: 5, closedIssues: 20, avgCommentsPerIssue: 2}],
  ['T3 fork@0.04+0',       {...base, stars: 6000, forks: 240, size: 900, recentCommitsCount: 40, openIssues: 5, closedIssues: 20, avgCommentsPerIssue: 2}],
  ['T4 redflag no-forks',  {...base, stars: 50000, forks: 100, size: 900, recentCommitsCount: 50, openIssues: 100, closedIssues: 900, avgCommentsPerIssue: 5}],
  ['T4 excellent',         {...base, stars: 50000, forks: 15000, size: 900, recentCommitsCount: 50, openIssues: 100, closedIssues: 900, avgCommentsPerIssue: 5}],
  ['T4 fork@0.0499',       {...base, stars: 100000, forks: 4990, size: 900, recentCommitsCount: 40, openIssues: 50, closedIssues: 500, avgCommentsPerIssue: 3}],
  ['T4 fork@0.05',         {...base, stars: 100000, forks: 5000, size: 900, recentCommitsCount: 40, openIssues: 50, closedIssues: 500, avgCommentsPerIssue: 3}],
  ['T1 undefined fields',  {stars: 30}],
];

const expectations = [
  [96, 'healthy', 1, false], [30, 'danger', 1, false], [70, 'warning', 1, false], [30, 'danger', 1, false],
  [100, 'healthy', 2, false], [100, 'healthy', 2, false], [2, 'danger', 2, false], [75, 'healthy', 2, false],
  [83, 'healthy', 2, false], [83, 'healthy', 2, false], [68, 'warning', 3, false], [87, 'healthy', 3, false],
  [87, 'healthy', 3, false], [30, 'danger', 4, true], [100, 'healthy', 4, false], [90, 'healthy', 4, false],
  [90, 'healthy', 4, false], [92, 'healthy', 1, false],
];

let failures = 0;
for (let i = 0; i < cases.length; i++) {
  const [name, data] = cases[i];
  const [expScore, expColor, expTier, expRedFlag] = expectations[i];
  const r = calculateTrustScore(data);
  let ok = r.score === expScore && r.color === expColor && r.tier.tier === expTier && r.redFlag === expRedFlag;
  const status = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(
    `${String(name).padEnd(24)} | ${status} score=${String(r.score).padStart(3)} color=${r.color.padEnd(7)} tier=${r.tier.tier} redFlag=${r.redFlag}`
  );
}
console.log(`\n${failures === 0 ? 'ALL 18 PASSED' : failures + ' FAILURES'}`);
process.exitCode = failures === 0 ? 0 : 1;
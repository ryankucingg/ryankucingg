/**
 * The profile's cards, drawn here instead of by a hosted stats service: numbers, languages, streak and a year of
 * paw prints (one per day, darker on busier days), each in a light and a dark version (cards/*-light.svg,
 * cards/*-dark.svg) in the Catzoid palette. Run by .github/workflows/cards.yml every day; locally:
 *   GH_TOKEN=$(gh auth token) node scripts/cards.mjs
 * Languages and stars count the repositories of the user and of the organisations in ORGS.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const LOGIN = process.env.GITHUB_USERNAME || 'ryankucingg';
const ORGS = ['catzoidhub'];
const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) throw new Error('GH_TOKEN is not set');

const THEMES = {
  light: { bg: '#fcfcff', line: '#e6e6ef', text: '#31323d', muted: '#61626f', primary: '#6c5de7', secondary: '#a35de4', empty: '#ececf3' },
  dark: { bg: '#24242c', line: '#34343f', text: '#d3d3db', muted: '#9697a2', primary: '#9996ff', secondary: '#c190f6', empty: '#2e2e38' },
};
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

async function gql(query, variables) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': LOGIN },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

const REPOS = `nodes { nameWithOwner isFork stargazerCount languages(first: 12, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } } }`;

async function collect() {
  const { user } = await gql(
    `query($login: String!) { user(login: $login) { createdAt followers { totalCount }
      repositories(ownerAffiliations: OWNER, first: 100) { ${REPOS} } } }`,
    { login: LOGIN },
  );
  const repos = [...user.repositories.nodes];
  for (const org of ORGS) {
    const { organization } = await gql(`query($org: String!) { organization(login: $org) { repositories(first: 100) { ${REPOS} } } }`, { org });
    repos.push(...organization.repositories.nodes);
  }

  // every year since the account was made, for the totals and the streak
  const days = [];
  let commits = 0, prs = 0, reviews = 0, issues = 0, contributions = 0;
  for (let y = new Date(user.createdAt).getUTCFullYear(); y <= new Date().getUTCFullYear(); y++) {
    const { user: u } = await gql(
      `query($login: String!, $from: DateTime!, $to: DateTime!) { user(login: $login) { contributionsCollection(from: $from, to: $to) {
        totalCommitContributions restrictedContributionsCount totalPullRequestContributions totalPullRequestReviewContributions totalIssueContributions
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } } } } }`,
      { login: LOGIN, from: `${y}-01-01T00:00:00Z`, to: `${y}-12-31T23:59:59Z` },
    );
    const c = u.contributionsCollection;
    commits += c.totalCommitContributions + c.restrictedContributionsCount;
    prs += c.totalPullRequestContributions;
    reviews += c.totalPullRequestReviewContributions;
    issues += c.totalIssueContributions;
    contributions += c.contributionCalendar.totalContributions;
    for (const w of c.contributionCalendar.weeks) days.push(...w.contributionDays);
  }

  // the last year as GitHub shows it (53 weeks ending this week)
  const { user: last } = await gql(
    `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { totalContributions
      weeks { contributionDays { date weekday contributionCount contributionLevel } } } } } }`,
    { login: LOGIN },
  );

  return { repos, days, commits, prs, reviews, issues, contributions, followers: user.followers.totalCount, year: last.contributionsCollection.contributionCalendar };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (n) => n.toLocaleString('en-US');
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function frame(t, w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.primary}"/><stop offset="1" stop-color="${t.secondary}"/></linearGradient></defs>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="${t.bg}" stroke="${t.line}"/>
<g font-family="${FONT}">
<text x="24" y="38" font-size="16" font-weight="650" fill="url(#g)">${esc(title)}</text>
${body}
</g></svg>
`;
}

/** A paw print centred on (x, y), r = the pad's half width. */
const paw = (x, y, r, fill) =>
  `<g fill="${fill}"><ellipse cx="${x}" cy="${y + r * 0.35}" rx="${r}" ry="${r * 0.78}"/>` +
  [[-1.05, -0.55], [-0.38, -1.05], [0.38, -1.05], [1.05, -0.55]].map(([dx, dy]) => `<circle cx="${(x + dx * r).toFixed(2)}" cy="${(y + dy * r).toFixed(2)}" r="${(r * 0.36).toFixed(2)}"/>`).join('') +
  `</g>`;

function statsCard(d, t) {
  const stars = d.repos.filter((r) => !r.isFork).reduce((n, r) => n + r.stargazerCount, 0);
  const rows = [
    ['Contributions', d.contributions],
    ['Commits', d.commits],
    ['Pull requests', d.prs],
    ['Reviews', d.reviews],
    ['Issues', d.issues],
    ['Stars on my repos', stars],
  ];
  const body = rows
    .map(([k, v], i) => {
      const y = 72 + i * 25;
      return `${paw(32, y - 5, 4.2, t.primary)}<text x="46" y="${y}" font-size="13.5" fill="${t.muted}">${k}</text><text x="326" y="${y}" font-size="13.5" font-weight="650" fill="${t.text}" text-anchor="end">${num(v)}</text>`;
    })
    .join('\n');
  return frame(t, 350, 218, 'GitHub, all time', body);
}

function langsCard(d, t) {
  const size = new Map();
  for (const r of d.repos.filter((r) => !r.isFork))
    for (const e of r.languages.edges) {
      const cur = size.get(e.node.name) ?? { n: 0, color: e.node.color ?? t.muted };
      cur.n += e.size;
      size.set(e.node.name, cur);
    }
  const top = [...size.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const total = top.reduce((n, [, v]) => n + v.n, 0) || 1;
  let x = 24;
  const bar = top
    .map(([, v]) => {
      const w = (v.n / total) * 302;
      const s = `<rect x="${x.toFixed(2)}" y="56" width="${Math.max(w, 1).toFixed(2)}" height="9" fill="${v.color}"/>`;
      x += w;
      return s;
    })
    .join('');
  const list = top
    .map(([name, v], i) => {
      const cx = 24 + (i % 2) * 156, cy = 96 + Math.floor(i / 2) * 25;
      return `<circle cx="${cx + 5}" cy="${cy - 4}" r="5" fill="${v.color}"/><text x="${cx + 16}" y="${cy}" font-size="13" fill="${t.text}">${esc(name)} <tspan fill="${t.muted}">${((v.n / total) * 100).toFixed(1)}%</tspan></text>`;
    })
    .join('\n');
  return frame(t, 350, 218, 'Languages I write', `<clipPath id="bar"><rect x="24" y="56" width="302" height="9" rx="4.5"/></clipPath><g clip-path="url(#bar)">${bar}</g>\n${list}`);
}

function streakCard(d, t) {
  const today = new Date().toISOString().slice(0, 10);
  const days = d.days.filter((x) => x.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  let best = 0, bestEnd = null, run = 0;
  for (const x of days) {
    run = x.contributionCount > 0 ? run + 1 : 0;
    if (run > best) [best, bestEnd] = [run, x.date];
  }
  // today without a contribution yet does not break the current streak
  let cur = 0, i = days.length - 1;
  if (days[i]?.contributionCount === 0) i--;
  for (; i >= 0 && days[i].contributionCount > 0; i--) cur++;
  const bestStart = bestEnd ? days[days.findIndex((x) => x.date === bestEnd) - best + 1]?.date : null;
  const col = (x, big, label, sub) =>
    `<text x="${x}" y="98" font-size="34" font-weight="700" fill="${big === cur && label.startsWith('Current') ? 'url(#g)' : t.text}" text-anchor="middle">${num(big)}</text>
<text x="${x}" y="124" font-size="13" font-weight="600" fill="${t.text}" text-anchor="middle">${label}</text>
<text x="${x}" y="144" font-size="11.5" fill="${t.muted}" text-anchor="middle">${sub}</text>`;
  const body = [
    col(120, d.contributions, 'Contributions', `since ${fmtDay(days[0].date)}`),
    `<line x1="232" y1="66" x2="232" y2="148" stroke="${t.line}"/>`,
    col(350, cur, 'Current streak', cur ? `days in a row, to ${fmtDay(today)}` : 'the next one starts today'),
    `<line x1="468" y1="66" x2="468" y2="148" stroke="${t.line}"/>`,
    col(580, best, 'Longest streak', bestStart ? `${fmtDay(bestStart)} – ${fmtDay(bestEnd)}` : '—'),
  ].join('\n');
  return frame(t, 712, 172, 'Streak', body);
}

function pawsCard(d, t) {
  const levels = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const mix = (a, b, k) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
  };
  const shade = [t.empty, mix(t.empty, t.primary, 0.35), mix(t.empty, t.primary, 0.6), t.primary, t.secondary];
  const step = 12.6, left = 34, top = 64;
  const weeks = d.year.weeks;
  let months = '', lastMonth = -1;
  const cells = weeks
    .map((w, wi) =>
      w.contributionDays
        .map((x) => {
          const m = new Date(`${x.date}T00:00:00Z`).getUTCMonth();
          // a label per month, skipping the first week's when the next month starts within three weeks of it
          const soon = wi === 0 && weeks.slice(1, 4).some((w2) => w2.contributionDays.some((y) => new Date(`${y.date}T00:00:00Z`).getUTCMonth() !== m));
          if (x.weekday === 0 && m !== lastMonth && wi < weeks.length - 2 && !soon) {
            months += `<text x="${left + wi * step}" y="${top - 12}" font-size="10.5" fill="${t.muted}">${new Date(`${x.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</text>`;
            lastMonth = m;
          }
          return paw(left + wi * step + 4.5, top + x.weekday * step + 4.5, 3.1, shade[levels[x.contributionLevel]]).replace('<g ', `<g data-date="${x.date}" `);
        })
        .join(''),
    )
    .join('\n');
  const w = Math.ceil(left + weeks.length * step + 22);
  const legend = `<text x="${w - 152}" y="${top + 7 * step + 22}" font-size="10.5" fill="${t.muted}">Less</text>` +
    shade.map((c, i) => paw(w - 118 + i * 15, top + 7 * step + 18, 3.1, c)).join('') +
    `<text x="${w - 36}" y="${top + 7 * step + 22}" font-size="10.5" fill="${t.muted}">More</text>`;
  const days = ['', 'Mon', '', 'Wed', '', 'Fri', ''].map((s, i) => (s ? `<text x="${left - 8}" y="${top + i * step + 8}" font-size="10" fill="${t.muted}" text-anchor="end">${s}</text>` : '')).join('');
  return frame(t, w, top + 7 * step + 34, `${num(d.year.totalContributions)} paw prints in the last year`, `${months}${days}\n${cells}\n${legend}`);
}

const data = await collect();
mkdirSync(new URL('../cards/', import.meta.url), { recursive: true });
for (const [name, draw] of Object.entries({ stats: statsCard, languages: langsCard, streak: streakCard, paws: pawsCard }))
  for (const [theme, t] of Object.entries(THEMES)) writeFileSync(new URL(`../cards/${name}-${theme}.svg`, import.meta.url), draw(data, t));
console.log(`cards written: ${data.contributions} contributions, ${data.repos.length} repositories`);

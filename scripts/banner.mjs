/**
 * The header banner (assets/banner-light.svg, banner-dark.svg): a night-sky card with the Catzoid cat, the name and
 * the line under it. The logo is embedded as base64, because GitHub shows SVGs through <img>, where an outside
 * image would not load. Run once after a change:  node scripts/banner.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const logo = `data:image/png;base64,${readFileSync(new URL('../assets/catzoid.png', import.meta.url)).toString('base64')}`;
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

const THEMES = {
  dark: { bg1: '#110e2d', bg2: '#1e1a4a', text: '#f3f2ff', muted: '#b8b4e6', primary: '#9996ff', secondary: '#c190f6', paw: '#ffffff', pawA: 0.05, line: '#2d2a55' },
  light: { bg1: '#f3f1ff', bg2: '#e6e2ff', text: '#2a2650', muted: '#5c5890', primary: '#6c5de7', secondary: '#a35de4', paw: '#6c5de7', pawA: 0.07, line: '#d9d5f5' },
};

const paw = (x, y, r, fill, extra = '') =>
  `<g fill="${fill}" ${extra}><ellipse cx="${x}" cy="${y + r * 0.35}" rx="${r}" ry="${r * 0.78}"/>` +
  [[-1.05, -0.55], [-0.38, -1.05], [0.38, -1.05], [1.05, -0.55]].map(([dx, dy]) => `<circle cx="${(x + dx * r).toFixed(1)}" cy="${(y + dy * r).toFixed(1)}" r="${(r * 0.36).toFixed(1)}"/>`).join('') +
  `</g>`;

// a trail of paw prints wandering across the background, alternating left / right like a walking cat
const trail = (t) => {
  let out = '';
  for (let i = 0; i < 14; i++) {
    const x = 330 + i * 62, y = 230 - i * 9 + (i % 2 ? 14 : -14), a = -28 + (i % 2 ? 8 : -8);
    out += paw(0, 0, 9, t.paw, `opacity="${t.pawA}" transform="translate(${x} ${y}) rotate(${a})"`);
  }
  return out;
};

for (const [name, t] of Object.entries(THEMES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300" role="img" aria-label="Ryan N.R. — builder of Catzoid">
<title>Ryan N.R. — builder of Catzoid</title>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
  <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.primary}"/><stop offset="1" stop-color="${t.secondary}"/></linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${t.primary}" stop-opacity="0.35"/><stop offset="1" stop-color="${t.primary}" stop-opacity="0"/></radialGradient>
  <clipPath id="card"><rect width="1200" height="300" rx="24"/></clipPath>
</defs>
<g clip-path="url(#card)">
  <rect width="1200" height="300" fill="url(#bg)"/>
  <circle cx="150" cy="150" r="190" fill="url(#glow)"/>
  ${trail(t)}
  ${[[980, 60, 1.6], [1060, 40, 1], [1120, 95, 1.3], [1010, 130, 0.9], [1150, 210, 1.1], [900, 250, 0.8], [1090, 260, 1.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.text}" opacity="${name === 'dark' ? 0.5 : 0.18}"/>`).join('')}
</g>
<rect x="0.5" y="0.5" width="1199" height="299" rx="24" fill="none" stroke="${t.line}"/>
<image href="${logo}" x="60" y="60" width="180" height="180"/>
<g font-family="${FONT}">
  <text x="300" y="118" font-size="20" font-weight="600" letter-spacing="4" fill="${t.muted}">HI, I'M</text>
  <text x="300" y="178" font-size="60" font-weight="750" fill="${t.text}">Ryan N.R.</text>
  <text x="300" y="222" font-size="23" fill="${t.muted}">I build <tspan font-weight="700" fill="url(#ink)">Catzoid</tspan> — dev tools with nine lives. All cats, no catch.</text>
</g>
</svg>
`;
  writeFileSync(new URL(`../assets/banner-${name}.svg`, import.meta.url), svg);
}
console.log('banners written');

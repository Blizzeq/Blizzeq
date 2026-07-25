// GitHub activity card.
//
// Deliberately no star counter: the public repos have four stars between them,
// and a row of zeroes tells a visitor nothing. Contribution volume, breadth and
// language mix say considerably more.

import { color, emerald, langColor, textWidth } from '../lib/tokens.mjs';
import { doc, text, n, panel, ENTRANCE } from '../lib/svg.mjs';
import { compact, yearsSince } from '../lib/github.mjs';

const W = 1000;
const PAD = 30;
const H = 208;

export function stats(profile, data) {
  const tiles = [
    { value: compact(data.contributions), label: 'contributions · 12 months' },
    { value: String(data.activeRepos), label: 'repositories touched' },
    { value: String(data.publicRepos), label: 'public repositories' },
    { value: `${yearsSince(data.createdAt)}`, label: 'years on GitHub' },
  ];

  const colW = (W - PAD * 2) / tiles.length;

  const tileSvg = tiles
    .map((t, i) => {
      const cx = PAD + colW * i + colW / 2;
      return `<g class="fade" style="animation-delay:${n(i * 0.08)}s">
  ${text(t.value, { x: cx, y: 76, size: 36, fill: emerald[300], anchor: 'middle', weight: 'bold' })}
  ${text(t.label, { x: cx, y: 99, size: 10.5, fill: color.muted, anchor: 'middle', spacing: 0.8 })}
  <rect class="tick" x="${n(cx - 16)}" y="110" width="32" height="2" rx="1" fill="${emerald[700]}" style="animation-delay:${n(0.2 + i * 0.08)}s"/>
</g>`;
    })
    .join('');

  const totalBytes = Object.values(data.languageTotals).reduce((s, v) => s + v, 0) || 1;
  const langs = Object.entries(data.languageTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({
      name,
      value,
      pct: (value / totalBytes) * 100,
      color: langColor[name] ?? langColor.Other,
    }));

  const barY = 146;
  const barW = W - PAD * 2;
  let cx = PAD;
  const bar = langs
    .map((l) => {
      const seg = (l.value / totalBytes) * barW;
      const r = `<rect x="${n(cx)}" y="${barY}" width="${n(Math.max(seg - 2, 1))}" height="9" rx="2" fill="${l.color}"/>`;
      cx += seg;
      return r;
    })
    .join('');

  // Legend, centred as one run so it never drifts off the card.
  const items = langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`);
  const legendW = items.reduce((s, t) => s + textWidth(t, 10.5) + 30, 0) - 30;
  let lx = W / 2 - legendW / 2;
  const legend = langs
    .map((l, i) => {
      const label = items[i];
      const g = `<g><circle cx="${n(lx + 4)}" cy="${barY + 39}" r="4" fill="${l.color}"/>${text(label, { x: n(lx + 15), y: barY + 43, size: 10.5, fill: color.muted })}</g>`;
      lx += textWidth(label, 10.5) + 30;
      return g;
    })
    .join('');

  const style = `${ENTRANCE}
.tick{transform-box:fill-box;transform-origin:center;animation:tick .7s cubic-bezier(.4,0,.2,1)}
@keyframes tick{from{transform:scaleX(0)}}
.bar{transform-box:fill-box;transform-origin:left center;animation:grow 1.1s cubic-bezier(.4,0,.2,1) .3s}
@keyframes grow{from{transform:scaleX(0)}}`;

  const body = `
${panel(W, H)}
${tileSvg}
<g class="fade" style="animation-delay:.22s">
  <g class="bar">${bar}</g>
  ${legend}
</g>`;

  return doc({ width: W, height: H, title: 'GitHub activity', style, body });
}

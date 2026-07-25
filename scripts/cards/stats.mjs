// GitHub activity card.
//
// Deliberately no star counter: the public repos have four stars between them,
// and a row of zeroes tells a visitor nothing.
//
// The language bar is captioned with what it actually measures. Unlabelled, it
// reads as "this person writes 78% TypeScript", which is a claim about the
// person rather than about ten hand-picked repositories — and it contradicts a
// profile whose day job is Python and SQL. The caption is what makes it a fact
// instead of a misleading headline.

import { color, emerald, langColor, textWidth } from '../lib/tokens.mjs';
import { doc, text, n, panel, caption, ENTRANCE } from '../lib/svg.mjs';
import { compact, yearsSince } from '../lib/github.mjs';

const W = 1000;
const PAD = 30;

export function stats(profile, data, featuredCount) {
  // Two-line labels so each number carries its own time window, instead of
  // only the first one saying "12 months" and the rest being ambiguous.
  const tiles = [
    { value: compact(data.contributions), label: 'contributions', sub: 'past 12 months · incl. private' },
    { value: String(data.activeRepos), label: 'repositories', sub: 'active, past 12 months' },
    { value: String(data.publicRepos), label: 'public repositories', sub: 'excluding forks' },
    { value: `${yearsSince(data.createdAt)}`, label: 'years', sub: 'on GitHub' },
  ];

  const colW = (W - PAD * 2) / tiles.length;

  const tileSvg = tiles
    .map((t, i) => {
      const cx = PAD + colW * i + colW / 2;
      return `<g class="fade" style="animation-delay:${n(i * 0.08)}s">
  ${text(t.value, { x: cx, y: 74, size: 36, fill: emerald[300], anchor: 'middle', weight: 'bold' })}
  ${text(t.label, { x: cx, y: 96, size: 11, fill: color.text, anchor: 'middle', spacing: 0.6 })}
  ${text(t.sub, { x: cx, y: 112, size: 9.5, fill: color.dim, anchor: 'middle', spacing: 0.4 })}
</g>`;
    })
    .join('');

  // Top four, everything else pooled — otherwise the bar ends with slivers a
  // pixel wide that no one can see but that still need a legend entry.
  const totalBytes = Object.values(data.languageTotals).reduce((s, v) => s + v, 0) || 1;
  const sorted = Object.entries(data.languageTotals).sort((a, b) => b[1] - a[1]);
  const langs = sorted.slice(0, 4).map(([name, value]) => ({
    name,
    value,
    pct: (value / totalBytes) * 100,
    color: langColor[name] ?? langColor.Other,
  }));
  const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) {
    langs.push({ name: 'Other', value: rest, pct: (rest / totalBytes) * 100, color: langColor.Other });
  }

  const divY = 138;
  const capY = 162;
  const barY = 174;
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

  const items = langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`);
  const legendW = items.reduce((s, t) => s + textWidth(t, 10.5) + 30, 0) - 30;
  let lx = W / 2 - legendW / 2;
  const legend = langs
    .map((l, i) => {
      const label = items[i];
      const g = `<g><circle cx="${n(lx + 4)}" cy="${barY + 35}" r="4" fill="${l.color}"/>${text(label, { x: n(lx + 15), y: barY + 39, size: 10.5, fill: color.muted })}</g>`;
      lx += textWidth(label, 10.5) + 30;
      return g;
    })
    .join('');

  const H = barY + 39 + 24;

  const style = `${ENTRANCE}
.bar{transform-box:fill-box;transform-origin:left center;animation:grow 1.1s cubic-bezier(.4,0,.2,1) .3s}
@keyframes grow{from{transform:scaleX(0)}}`;

  const body = `
${panel(W, H)}
${tileSvg}
<line x1="${PAD}" y1="${divY}" x2="${W - PAD}" y2="${divY}" stroke="${color.borderSoft}"/>
<g class="fade" style="animation-delay:.22s">
  ${caption(`languages · across the ${featuredCount} featured repositories`, { cx: W / 2, y: capY, size: 9.5 })}
  <g class="bar">${bar}</g>
  ${legend}
</g>`;

  return doc({ width: W, height: H, title: 'GitHub activity', style, body });
}

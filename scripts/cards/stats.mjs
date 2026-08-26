// Compact GitHub activity card. The native contribution calendar already
// covers daily history, so this card only adds four useful summary numbers.

import { color, emerald } from '../lib/tokens.mjs';
import { doc, text, n, panel, ENTRANCE } from '../lib/svg.mjs';
import { compact, yearsSince } from '../lib/github.mjs';

const LAYOUTS = {
  desktop: { width: 1000, height: 142, pad: 30, columns: 4, rowHeight: 96 },
  narrow: { width: 400, height: 236, pad: 18, columns: 2, rowHeight: 104 },
};

export function stats(data, variant = 'desktop') {
  const layout = LAYOUTS[variant];
  if (!layout) throw new Error(`Unknown stats layout: ${variant}`);
  const { width: W, height: H, pad: PAD, columns, rowHeight } = layout;

  const tiles = [
    { value: compact(data.contributions), label: 'contributions', sub: 'past 12 months · incl. private' },
    { value: String(data.activeRepos), label: 'repositories', sub: 'active, past 12 months' },
    { value: String(data.publicRepos), label: 'public repositories', sub: 'excluding forks' },
    { value: `${yearsSince(data.createdAt)}`, label: 'years', sub: 'on GitHub' },
  ];

  const colW = (W - PAD * 2) / columns;
  const tileSvg = tiles
    .map((tile, i) => {
      const row = Math.floor(i / columns);
      const column = i % columns;
      const cx = PAD + colW * column + colW / 2;
      const valueY = 62 + row * rowHeight;
      return `<g class="fade" style="animation-delay:${n(i * 0.08)}s">
  ${text(tile.value, { x: cx, y: valueY, size: variant === 'narrow' ? 31 : 36, fill: emerald[300], anchor: 'middle', weight: 'bold' })}
  ${text(tile.label, { x: cx, y: valueY + 22, size: variant === 'narrow' ? 10 : 11, fill: color.text, anchor: 'middle', spacing: 0.5 })}
  ${text(tile.sub, { x: cx, y: valueY + 38, size: variant === 'narrow' ? 8.5 : 9.5, fill: color.dim, anchor: 'middle', spacing: 0.3 })}
</g>`;
    })
    .join('');

  const dividers = variant === 'narrow'
    ? `<line x1="${W / 2}" y1="18" x2="${W / 2}" y2="${H - 18}" stroke="${color.borderSoft}"/>
<line x1="${PAD}" y1="${H / 2}" x2="${W - PAD}" y2="${H / 2}" stroke="${color.borderSoft}"/>`
    : '';

  const body = `
${panel(W, H)}
${dividers}
${tileSvg}`;

  return doc({ width: W, height: H, title: 'GitHub activity', style: ENTRANCE, body });
}

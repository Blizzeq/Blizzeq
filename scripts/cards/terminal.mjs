// "About" card, shaped as a terminal session that types itself out.
//
// The reveal is a clip rect scaled on X with a stepped timing function, so each
// line appears character by character. Resting state is fully revealed — see
// the note on ENTRANCE in lib/svg.mjs for why that matters.

import { color, emerald, ADVANCE } from '../lib/tokens.mjs';
import { doc, text, n, esc, ENTRANCE } from '../lib/svg.mjs';

const W = 1000;
const CHROME = 42;
const PAD = 26;
const LINE = 22;
const SIZE = 13.5;

const TONE = {
  dim: color.muted,
  accent: emerald[400],
  bright: color.text,
};

export function terminal(profile) {
  const rows = [];
  for (const entry of profile.terminal) {
    rows.push({ kind: 'cmd', text: entry.cmd });
    for (const out of [entry.out]) rows.push({ kind: 'out', segs: out });
  }

  // Height is derived from where the layout actually finishes, further down.
  // Deriving it from a row count instead silently under-measures as soon as
  // the block spacing below changes, which pushed the closing prompt clean
  // off the bottom of the card.
  let y = CHROME + PAD + 14;
  let clips = '';
  let body = '';

  rows.forEach((row, i) => {
    const id = `t${i}`;
    const chars =
      row.kind === 'cmd'
        ? row.text.length + 2
        : row.segs.reduce((s, [t]) => s + t.length, 0);
    const wide = chars * SIZE * ADVANCE + 6;

    // One clip per line; the stagger is what makes it read as typing.
    clips += `<clipPath id="${id}"><rect class="type" x="${PAD}" y="${n(y - SIZE)}" width="${n(wide)}" height="${SIZE + 8}" style="animation-delay:${n(0.25 + i * 0.42)}s;animation-duration:${n(Math.max(0.3, chars * 0.022))}s"/></clipPath>`;

    if (row.kind === 'cmd') {
      body += `<g clip-path="url(#${id})">${text('$', { x: PAD, y, size: SIZE, fill: emerald[500], weight: 'bold' })}${text(row.text, { x: PAD + SIZE * ADVANCE * 2, y, size: SIZE, fill: color.text })}</g>`;
    } else {
      const tspans = row.segs
        .map(([t, tone]) => `<tspan fill="${TONE[tone] ?? color.muted}">${esc(t)}</tspan>`)
        .join('');
      body += `<g clip-path="url(#${id})"><text x="${PAD}" y="${n(y)}" font-size="${SIZE}">${tspans}</text></g>`;
    }

    y += LINE;
    // Breathing room between command blocks, the way a real session reads.
    if (row.kind === 'out') y += 12;
  });

  // The trailing `$` sits one block-gap below the last output, and the card
  // closes with the same padding it opens with.
  const promptY = y + 2;
  const H = Math.round(promptY + 6 + PAD);

  const defs = clips;

  const style = `${ENTRANCE}
/* Stepped scaleX reads as character-by-character typing. Resting scale is 1. */
.type{transform-box:fill-box;transform-origin:left center;animation-name:type;animation-timing-function:steps(24);animation-fill-mode:none}
@keyframes type{from{transform:scaleX(0)}}
.caret{animation:caret 1.15s steps(1) infinite}
@keyframes caret{0%,49%{opacity:1}50%,100%{opacity:0}}`;

  const body2 = `
<rect width="${W}" height="${H}" rx="12" fill="${color.surface}"/>
<path d="M12,0.5 h${W - 24} a11.5,11.5 0 0 1 11.5,11.5 v${CHROME - 12} h-${W - 1} v-${CHROME - 12} a11.5,11.5 0 0 1 11.5,-11.5 z" fill="${color.raised}"/>
<line x1="0.5" y1="${CHROME}" x2="${W - 0.5}" y2="${CHROME}" stroke="${color.border}"/>
<circle cx="${PAD}" cy="${CHROME / 2}" r="6" fill="#ff5f56"/>
<circle cx="${PAD + 20}" cy="${CHROME / 2}" r="6" fill="#ffbd2e"/>
<circle cx="${PAD + 40}" cy="${CHROME / 2}" r="6" fill="#27c93f"/>
${text('jakub@axpo: ~', { x: W / 2, y: CHROME / 2 + 4, size: 12, fill: color.muted, anchor: 'middle' })}
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${color.border}"/>

<g class="fade">
${body}
${text('$', { x: PAD, y: promptY, size: SIZE, fill: emerald[500], weight: 'bold' })}
<rect class="caret" x="${n(PAD + SIZE * ADVANCE * 2)}" y="${n(promptY - SIZE + 2)}" width="${n(SIZE * ADVANCE)}" height="${SIZE + 1}" fill="${emerald[400]}"/>
</g>`;

  return doc({ width: W, height: H, title: 'About Jakub Krasuski — terminal session', defs, style, body: body2 });
}

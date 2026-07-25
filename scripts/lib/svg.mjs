// Small SVG authoring helpers. No dependencies — everything here emits plain
// strings, because the output has to survive being loaded through <img> on
// GitHub, where no script ever runs.

import { color, emerald, font, textWidth, radius } from './tokens.mjs';

/**
 * Shared entrance animation.
 *
 * Deliberately written so the *resting* state is the visible one: the keyframe
 * only declares `from`, and fill-mode stays `none`. Anything that freezes or
 * disables animation — reduced-motion, a throttled background tab, a renderer
 * that ignores CSS animation — lands on the element's own styles and the
 * content is simply there. The obvious spelling (`opacity:0` plus a `to`
 * keyframe) hides everything permanently in exactly those cases.
 */
export const ENTRANCE = `
.fade{animation:fade .9s ease-out}
@keyframes fade{from{opacity:0}}`;

/** Escape text for use inside an XML node or attribute. */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Round to 2dp so generated files stay byte-stable between builds. */
export const n = (v) => Math.round(v * 100) / 100;

/**
 * Deterministic PRNG (mulberry32).
 *
 * The daily GitHub Action regenerates every asset. If decorative geometry used
 * Math.random it would differ on every run and the workflow would commit noise
 * forever, so anything "random" is seeded and reproducible.
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wrap a document. `title` becomes the accessible name — screen readers get
 * something useful even though the file is decorative.
 */
export function doc({ width, height, title, defs = '', style = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}" font-family="${font}">
<title>${esc(title)}</title>
<defs>${defs}</defs>
<style>${style}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>
${body}
</svg>
`;
}

/** Panel background used by every card-style asset. */
export function panel(w, h, { fill = color.surface, stroke = color.border, r = radius.md, x = 0, y = 0 } = {}) {
  return `<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="${n(w - 1)}" height="${n(h - 1)}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
}

export function text(s, { x, y, size = 13, fill = color.text, anchor = 'start', weight, spacing, cls, opacity } = {}) {
  const a = [
    `x="${n(x)}"`,
    `y="${n(y)}"`,
    `font-size="${size}"`,
    `fill="${fill}"`,
    anchor !== 'start' ? `text-anchor="${anchor}"` : '',
    weight ? `font-weight="${weight}"` : '',
    spacing ? `letter-spacing="${spacing}"` : '',
    cls ? `class="${cls}"` : '',
    opacity != null ? `opacity="${opacity}"` : '',
  ].filter(Boolean).join(' ');
  return `<text ${a}>${esc(s)}</text>`;
}

/**
 * A rounded label with its box sized from the monospace advance width.
 * `tone` picks how loud the chip is — used to encode day-to-day tools versus
 * occasional ones rather than making every chip shout equally.
 */
export function chip(label, { x, y, size = 12, tone = 'normal', padX = 11, h = 26, cls } = {}) {
  const w = textWidth(label, size) + padX * 2;
  // Three clearly separated steps. The previous `strong` and `normal` differed
  // only by a faint tint and read as the same weight, which defeated the point
  // of encoding how often something is actually used.
  const tones = {
    strong: { fill: 'rgba(16,185,129,0.22)', stroke: emerald[500], text: emerald[200] },
    normal: { fill: color.bg, stroke: color.border, text: emerald[400] },
    quiet: { fill: 'transparent', stroke: color.borderSoft, text: '#6f7b87' },
  };
  const t = tones[tone] ?? tones.normal;
  return {
    w,
    svg: `<g${cls ? ` class="${cls}"` : ''}><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${h}" rx="${radius.sm}" fill="${t.fill}" stroke="${t.stroke}"/>${text(label, { x: n(x + w / 2), y: n(y + h / 2 + size * 0.36), size, fill: t.text, anchor: 'middle' })}</g>`,
  };
}

/**
 * Lay chips out in centred rows that wrap at `maxW`.
 * Returns the markup plus the height consumed, so callers can stack sections
 * without hand-tuning coordinates the way the old hand-written assets did.
 */
export function chipRows(items, { cx, y, maxW, gap = 8, rowGap = 10, size = 12, h = 26, padX = 11, delayBase = 0, stagger = 0.04 }) {
  const measured = items.map((it) => {
    const label = typeof it === 'string' ? it : it.label;
    const tone = typeof it === 'string' ? 'normal' : it.tone;
    return { label, tone, w: textWidth(label, size) + padX * 2 };
  });

  const rows = [];
  let row = [];
  let rowW = 0;
  for (const m of measured) {
    const add = row.length ? gap + m.w : m.w;
    if (rowW + add > maxW && row.length) {
      rows.push({ items: row, w: rowW });
      row = [m];
      rowW = m.w;
    } else {
      row.push(m);
      rowW += add;
    }
  }
  if (row.length) rows.push({ items: row, w: rowW });

  let out = '';
  let i = 0;
  rows.forEach((r, ri) => {
    let x = cx - r.w / 2;
    const ry = y + ri * (h + rowGap);
    for (const m of r.items) {
      const c = chip(m.label, { x, y: ry, size, tone: m.tone, h, padX, cls: 'chip' });
      out += c.svg.replace('<g class="chip">', `<g class="chip" style="animation-delay:${n(delayBase + i * stagger)}s">`);
      x += m.w + gap;
      i++;
    }
  });

  return { svg: out, height: rows.length * h + (rows.length - 1) * rowGap };
}

/** Section caption: small, tracked-out, muted. */
export function caption(s, { cx, y, size = 10.5 }) {
  return text(s.toUpperCase(), { x: cx, y, size, fill: color.dim, anchor: 'middle', spacing: 2.4 });
}

/**
 * A stacked bar of language shares. Widths animate from zero on load, which is
 * cheap (transform only) and gives each card a moment of life.
 */
export function langBar(langs, { x, y, w, h = 5, delay = 0 }) {
  const total = langs.reduce((s, l) => s + l.value, 0) || 1;
  let cx = x;
  let out = `<g class="langbar" style="animation-delay:${n(delay)}s">`;
  langs.forEach((l) => {
    const seg = (l.value / total) * w;
    if (seg < 0.5) return;
    out += `<rect x="${n(cx)}" y="${n(y)}" width="${n(seg)}" height="${h}" fill="${l.color}"/>`;
    cx += seg;
  });
  out += '</g>';
  return out;
}

/** Truncate to a character budget, adding an ellipsis when it does not fit. */
export function clamp(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

/** Greedy word wrap by character budget (safe because the font is monospace). */
export function wrap(s, max, maxLines = 2) {
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = word;
      if (lines.length === maxLines) break;
    } else {
      cur = next;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && cur && lines[maxLines - 1] !== cur) {
    lines[maxLines - 1] = clamp(`${lines[maxLines - 1]} ${cur}`, max);
  }
  return lines.slice(0, maxLines);
}

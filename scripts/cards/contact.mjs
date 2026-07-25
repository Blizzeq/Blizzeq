// Contact badges and the closing rule.
//
// Hand-rolled rather than shields.io: one less external host that can fail,
// and the styling matches everything else.
//
// Each badge is its own file. A single combined strip would have to sit inside
// one <a>, which would send every badge to whichever link was chosen.

import { color, emerald, textWidth } from '../lib/tokens.mjs';
import { doc, text, n, ENTRANCE } from '../lib/svg.mjs';
import { dayCurvePath } from './hero.mjs';

/** Monochrome glyphs, drawn rather than fetched. */
const ICONS = {
  linkedin: (x, y, c) =>
    `<g fill="${c}" transform="translate(${n(x)},${n(y)}) scale(0.05)"><path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"/></g>`,
  mail: (x, y, c) =>
    `<g fill="none" stroke="${c}" stroke-width="1.7" transform="translate(${n(x)},${n(y)})"><rect x="0" y="0" width="21" height="16" rx="2.5"/><path d="M1 1.4 10.5 9.4 20 1.4"/></g>`,
  github: (x, y, c) =>
    `<g fill="${c}" transform="translate(${n(x)},${n(y)}) scale(0.043)"><path d="M248 8C111 8 0 119 0 256c0 110 71 203 170 236 12 2 16-5 16-12v-42c-69 15-84-33-84-33-11-29-28-37-28-37-23-15 2-15 2-15 25 2 38 26 38 26 22 38 58 27 72 21 2-16 9-27 16-33-55-6-113-28-113-124 0-27 10-50 26-67-3-7-11-33 2-69 0 0 21-7 69 26 20-6 41-9 62-9s42 3 62 9c48-33 69-26 69-26 13 36 5 62 2 69 16 17 26 40 26 67 0 96-58 118-113 124 9 8 17 23 17 46v68c0 7 4 14 17 12 99-33 170-126 170-236C496 119 385 8 248 8z"/></g>`,
};

const SIZE = 12.5;
const H = 46;
const BAR = 36;
const PAD_X = 17;
const ICON_W = 32;

export function badge({ icon, label, title }) {
  const w = textWidth(label, SIZE) + PAD_X * 2 + ICON_W;
  const y = (H - BAR) / 2;

  const body = `<g class="fade">
  <rect x="0.5" y="${n(y + 0.5)}" width="${n(w - 1)}" height="${BAR - 1}" rx="${(BAR - 1) / 2}" fill="rgba(16,185,129,0.09)" stroke="${emerald[800]}"/>
  ${ICONS[icon](PAD_X, y + (BAR - 16) / 2 - (icon === 'mail' ? 0 : 2), emerald[300])}
  ${text(label, { x: n(PAD_X + ICON_W), y: n(H / 2 + SIZE * 0.36), size: SIZE, fill: emerald[200] })}
</g>`;

  return doc({ width: Math.ceil(w), height: H, title, style: ENTRANCE, body });
}

/**
 * Closing rule.
 *
 * Draws the hero's own day curve rather than a generic sine, so the page opens
 * and closes on the same shape. Static: the animation budget is spent at the
 * top, and a drifting line down here would only compete with it.
 */
export function footer(tagline) {
  const W = 1000;
  const H = 78;
  const curve = dayCurvePath({ width: W, top: 16, base: 46, pad: 40 });

  const defs = `<linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="${emerald[500]}" stop-opacity="0"/>
  <stop offset="22%" stop-color="${emerald[500]}" stop-opacity="0.42"/>
  <stop offset="78%" stop-color="${emerald[500]}" stop-opacity="0.42"/>
  <stop offset="100%" stop-color="${emerald[500]}" stop-opacity="0"/>
</linearGradient>`;

  return doc({
    width: W,
    height: H,
    title: '',
    defs,
    style: ENTRANCE,
    body: `<g class="fade">
  <path d="${curve}" fill="none" stroke="url(#fade)" stroke-width="1.5" stroke-linecap="round"/>
  ${tagline ? text(tagline, { x: W / 2, y: 70, size: 10.5, fill: color.dim, anchor: 'middle', spacing: 1.4 }) : ''}
</g>`,
  });
}

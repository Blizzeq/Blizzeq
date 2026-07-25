// Project cards in three sizes. Size encodes weight: the flagship gets the
// full width, the main set a half column, and the algorithm-visualiser family
// a compact row — rather than pretending ten projects matter equally.
//
// Vertical rhythm is walked top to bottom and the height falls out of where the
// layout ends, so the gaps stay equal instead of being pinned to a guessed
// height. Space for every pitch line is reserved whether or not the text needs
// it, which keeps two cards sitting side by side exactly the same height.
//
// No star counts anywhere: they would read as a row of zeroes and say nothing
// about the work.

import { color, emerald, langColor, textWidth, radius } from '../lib/tokens.mjs';
import { doc, text, n, panel, wrap, clamp, langBar, chip, ENTRANCE } from '../lib/svg.mjs';

const SIZES = {
  hero: {
    w: 1000, pad: 28, name: 22, pitch: 13, lead: 19, lines: 2,
    chipSize: 11, chipH: 24, barH: 5, foot: 9.5,
    afterName: 28, afterPitch: 20, afterChips: 22, afterBar: 17, bottom: 16,
  },
  std: {
    w: 492, pad: 20, name: 15.5, pitch: 11.5, lead: 18, lines: 2,
    chipSize: 10, chipH: 22, barH: 5, foot: 9.5,
    afterName: 24, afterPitch: 18, afterChips: 20, afterBar: 16, bottom: 14,
  },
  compact: {
    w: 325, pad: 16, name: 13, pitch: 10, lead: 15, lines: 2,
    chipSize: 9.5, chipH: 0, barH: 4, foot: 8.5,
    afterName: 22, afterPitch: 16, afterChips: 0, afterBar: 14, bottom: 12,
  },
};

/** Top languages for a repo, normalised for the bar. */
function languages(bytes = {}) {
  const entries = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 4);
  const rest = entries.slice(4).reduce((s, [, v]) => s + v, 0);
  const out = top.map(([name, value]) => ({
    name,
    value,
    color: langColor[name] ?? langColor.Other,
  }));
  if (rest > 0) out.push({ name: 'Other', value: rest, color: langColor.Other });
  return out;
}

export function projectCard(repo, project, stats, variant = 'std') {
  const s = SIZES[variant];
  const langs = languages(stats.languagesByRepo?.[repo]);
  const primary = langs[0];
  const hasChips = variant !== 'compact' && Boolean(project.tags?.length);

  const usableChars = Math.floor((s.w - s.pad * 2) / (s.pitch * 0.6));
  const pitchLines = wrap(project.pitch, usableChars, s.lines);

  const isDemo = Boolean(project.demo);
  const badgeText = isDemo ? 'live demo' : project.badge ?? '';

  // --- vertical rhythm -----------------------------------------------------
  const nameY = s.pad + s.name * 0.78;
  const pitchTop = nameY + s.afterName;
  // Reserve every line, used or not, so a short pitch cannot shrink the card.
  const pitchBottom = pitchTop + (s.lines - 1) * s.lead;
  const chipsTop = pitchBottom + s.afterPitch;
  const barY = hasChips
    ? chipsTop + s.chipH + s.afterChips
    : pitchBottom + s.afterPitch;
  const footY = barY + s.barH + s.afterBar;
  const h = Math.round(footY + s.bottom);

  const badgeSize = variant === 'compact' ? 8.5 : 9.5;
  const badgeW = textWidth(badgeText, badgeSize) + (isDemo ? 26 : 18);
  const badgeH = variant === 'compact' ? 16 : 18;
  const badgeY = s.pad - 4;
  const badgeX = s.w - s.pad - badgeW;

  const pitch = pitchLines
    .map((line, i) => text(line, { x: s.pad, y: pitchTop + i * s.lead, size: s.pitch, fill: color.muted }))
    .join('');

  let chips = '';
  if (hasChips) {
    let cx = s.pad;
    project.tags.forEach((tag, i) => {
      const c = chip(tag, { x: cx, y: chipsTop, size: s.chipSize, h: s.chipH, tone: i === 0 ? 'strong' : 'normal', padX: 9 });
      if (cx + c.w <= s.w - s.pad) {
        chips += c.svg;
        cx += c.w + 7;
      }
    });
  }

  const style = `${ENTRANCE}
.pulse{animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
.langbar{transform-box:fill-box;transform-origin:left center;animation:grow 1s cubic-bezier(.4,0,.2,1) .25s}
@keyframes grow{from{transform:scaleX(0)}}
${variant === 'compact' ? '' : `
/* Slow diagonal sweep. Parks off the left edge at rest, so a still frame is clean. */
.sweep{animation:sweep 9s ease-in-out infinite}
@keyframes sweep{0%,22%{transform:translateX(0)}70%,100%{transform:translateX(${n(s.w + 300)}px)}}`}`;

  const defs = `
<clipPath id="card"><rect width="${s.w}" height="${h}" rx="${radius.md}"/></clipPath>
<linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="${emerald[400]}" stop-opacity="0"/>
  <stop offset="50%" stop-color="${emerald[400]}" stop-opacity="0.07"/>
  <stop offset="100%" stop-color="${emerald[400]}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="${emerald[700]}"/>
  <stop offset="50%" stop-color="${emerald[400]}"/>
  <stop offset="100%" stop-color="${emerald[700]}"/>
</linearGradient>`;

  const sweep =
    variant === 'compact'
      ? ''
      : `<g clip-path="url(#card)"><rect class="sweep" x="-260" y="0" width="180" height="${h}" fill="url(#sweepGrad)" transform="skewX(-18)"/></g>`;

  const body = `
${panel(s.w, h, { fill: color.surface })}
${sweep}
<!-- Accent stays emerald on every card; language colour lives in the data bar
     at the foot, where it reads as information rather than decoration. -->
<rect x="0.5" y="0.5" width="${s.w - 1}" height="2.5" rx="1" fill="url(#accent)" opacity="0.9"/>

<g class="fade">
  ${text(project.display, { x: s.pad, y: nameY, size: s.name, fill: emerald[300], weight: 'bold' })}
  ${badgeText
      ? `<g><rect x="${n(badgeX)}" y="${n(badgeY)}" width="${n(badgeW)}" height="${badgeH}" rx="${badgeH / 2}" fill="${isDemo ? 'rgba(16,185,129,0.12)' : color.bg}" stroke="${isDemo ? emerald[700] : color.border}"/>${isDemo ? `<circle cx="${n(badgeX + 11)}" cy="${n(badgeY + badgeH / 2)}" r="3" fill="${emerald[400]}" class="pulse"/>` : ''}${text(badgeText, { x: n(badgeX + badgeW / 2 + (isDemo ? 6 : 0)), y: n(badgeY + badgeH / 2 + badgeSize * 0.35), size: badgeSize, fill: isDemo ? emerald[300] : color.muted, anchor: 'middle' })}</g>`
      : ''}
  ${pitch}
  ${chips}
  ${langBar(langs, { x: s.pad, y: barY, w: s.w - s.pad * 2, h: s.barH, delay: 0.25 })}
  ${text(clamp(`${repo}`, variant === 'compact' ? 30 : 46), { x: s.pad, y: footY, size: s.foot, fill: color.dim })}
  ${primary ? text(primary.name, { x: s.w - s.pad, y: footY, size: s.foot, fill: color.dim, anchor: 'end' }) : ''}
</g>`;

  return doc({
    width: s.w,
    height: h,
    title: `${project.display} — ${project.pitch}`,
    defs,
    style,
    body,
  });
}

/**
 * The strip that sits under a card.
 *
 * A README card is a single <img> inside a single <a>, and links inside an SVG
 * do nothing in that context — so a "live demo" badge drawn on the card cannot
 * be clicked on its own. This is a second, separately linked image, which is
 * what makes the demo actually reachable.
 */
export function ctaButton({ width, label }) {
  const H = 34;
  const SIZE = 11;
  const caption = `${label}   →`;

  // Deliberately quiet: the card above it is the primary target, this is the
  // secondary way in.
  const body = `
<rect x="0.5" y="0.5" width="${width - 1}" height="${H - 1}" rx="8"
      fill="${color.surface}" stroke="${color.border}"/>
<g class="fade">
  ${text(caption, { x: width / 2, y: H / 2 + SIZE * 0.36, size: SIZE, fill: color.muted, anchor: 'middle', spacing: 0.6 })}
</g>`;

  return doc({ width, height: H, title: label, style: ENTRANCE, body });
}

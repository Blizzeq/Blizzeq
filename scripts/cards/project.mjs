// Project cards in three sizes. Size encodes weight: the flagship gets the
// full width, the main set a half column, and the algorithm-visualiser family
// a compact row — rather than pretending ten projects matter equally.
//
// No star counts anywhere: they would read as a row of zeroes and say nothing
// about the work.

import { color, emerald, langColor, textWidth, radius } from '../lib/tokens.mjs';
import { doc, text, n, panel, wrap, clamp, langBar, chip, ENTRANCE } from '../lib/svg.mjs';

const SIZES = {
  hero: { w: 1000, h: 186, pad: 28, name: 22, pitch: 13, chipSize: 11, lines: 2 },
  std: { w: 492, h: 204, pad: 20, name: 15.5, pitch: 11.5, chipSize: 10, lines: 2 },
  compact: { w: 325, h: 132, pad: 16, name: 13, pitch: 10, chipSize: 9.5, lines: 2 },
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

  const usableChars = Math.floor((s.w - s.pad * 2) / (s.pitch * 0.6));
  const pitchLines = wrap(project.pitch, usableChars, s.lines);

  const isDemo = Boolean(project.demo);
  const badgeText = isDemo ? 'live demo' : project.badge ?? '';

  // Badge sits top-right, vertically centred on the title.
  const badgeSize = variant === 'compact' ? 8.5 : 9.5;
  const badgeW = textWidth(badgeText, badgeSize) + (isDemo ? 26 : 18);
  const badgeH = variant === 'compact' ? 16 : 18;
  const badgeY = s.pad - 4;
  const badgeX = s.w - s.pad - badgeW;

  const nameY = s.pad + s.name * 0.78;

  let y = nameY + (variant === 'hero' ? 30 : 24);
  const pitch = pitchLines
    .map((line, i) => text(line, { x: s.pad, y: y + i * (s.pitch + 6), size: s.pitch, fill: color.muted }))
    .join('');
  y += (pitchLines.length - 1) * (s.pitch + 6);

  // Chips: the compact variant skips them — its job is to be scannable.
  let chips = '';
  if (variant !== 'compact' && project.tags?.length) {
    let cx = s.pad;
    const cy = variant === 'hero' ? 112 : 116;
    project.tags.forEach((tag, i) => {
      const c = chip(tag, { x: cx, y: cy, size: s.chipSize, h: variant === 'hero' ? 24 : 22, tone: i === 0 ? 'strong' : 'normal', padX: 9 });
      if (cx + c.w <= s.w - s.pad) {
        chips += c.svg;
        cx += c.w + 7;
      }
    });
  }

  const barY = s.h - s.pad - (variant === 'compact' ? 14 : 22);
  const footY = s.h - s.pad + (variant === 'compact' ? 2 : 4);

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
<clipPath id="card"><rect width="${s.w}" height="${s.h}" rx="${radius.md}"/></clipPath>
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
      : `<g clip-path="url(#card)"><rect class="sweep" x="-260" y="0" width="180" height="${s.h}" fill="url(#sweepGrad)" transform="skewX(-18)"/></g>`;

  const body = `
${panel(s.w, s.h, { fill: color.surface })}
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
  ${langBar(langs, { x: s.pad, y: barY, w: s.w - s.pad * 2, h: variant === 'compact' ? 4 : 5, delay: 0.25 })}
  ${text(clamp(`${repo}`, variant === 'compact' ? 30 : 46), { x: s.pad, y: footY, size: variant === 'compact' ? 8.5 : 9.5, fill: color.dim })}
  ${primary ? text(primary.name, { x: s.w - s.pad, y: footY, size: variant === 'compact' ? 8.5 : 9.5, fill: color.dim, anchor: 'end' }) : ''}
</g>`;

  return doc({
    width: s.w,
    height: s.h,
    title: `${project.display} — ${project.pitch}`,
    defs,
    style,
    body,
  });
}

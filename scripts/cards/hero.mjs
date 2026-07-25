// Hero banner.
//
// One idea rather than three: a price curve along the bottom with a cursor
// that rides it and reads out values the way a trading chart does, a thin
// strip of chrome up top, and the name breathing in the clear space between.
//
// Two rules everything here follows:
//   1. Every animation rests in its *finished* state. A frozen timeline,
//      reduced-motion, or a renderer that ignores CSS all land on a complete,
//      composed banner instead of a half-drawn one.
//   2. Motion is CSS, never SMIL, so prefers-reduced-motion actually applies.

import { color, emerald, display, ADVANCE } from '../lib/tokens.mjs';
import { doc, text, n, esc, ENTRANCE } from '../lib/svg.mjs';

const W = 1000;
const H = 320;

// Chart band. PAD is wide enough that the readout pill, which is centred on
// the cursor, still clears both edges at the first and last sample.
const TOP = 206;
const BASE = 288;
const PAD = 64;

const HOURS = 24;

// Cursor timing.
//
// The lead-in and the closing beat are *inside* the cycle rather than in
// `animation-delay`, and nothing here carries a delay in its shorthand. That is
// deliberate: the readouts must set `animation-delay` per element to pick their
// slot, and an inline delay silently overrides the one in a shorthand. When the
// cursor kept a 1.4s delay and the readouts did not, the two ran 1.4s — a full
// 3.7 hours — out of phase: the dot sat on 13:00 under a label reading 17:00,
// parked at the right edge while the clock ran on, then restarted at 00:00 with
// the label already at 03:44. With every animation phased from t=0 there is no
// offset left to disagree about.
const LEAD = 1.4; // parked on 00:00 while the curve draws itself in
const SWEEP = 9; // 00:00 → 23:00
const TAIL = 0.6; // a beat on 23:00 before the loop restarts
const CYCLE = LEAD + SWEEP + TAIL;
const STEP = SWEEP / (HOURS - 1); // seconds per hour

/**
 * A day-shaped curve: overnight trough, morning ramp, midday plateau, evening
 * peak. Hand-picked rather than random so it reads like a real profile and
 * stays byte-identical between builds.
 */
const PROFILE = [
  0.30, 0.24, 0.20, 0.19, 0.22, 0.30, 0.44, 0.58,
  0.66, 0.69, 0.66, 0.62, 0.60, 0.62, 0.66, 0.72,
  0.83, 0.95, 0.92, 0.80, 0.68, 0.56, 0.44, 0.34,
];

/** Values tied to the curve, so the readout and the shape agree. */
const value = (v) => 165 + 610 * Math.pow(v, 1.75);

function points() {
  const span = W - PAD * 2;
  return PROFILE.map((v, i) => ({
    x: PAD + (i / (HOURS - 1)) * span,
    y: BASE - v * (BASE - TOP),
  }));
}

/** Control points of the cubic segment between pts[i] and pts[i+1]. */
function segment(pts, i) {
  const p0 = pts[i - 1] ?? pts[i];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[i + 2] ?? p2;
  return {
    p1,
    c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
    c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
    p2,
  };
}

/**
 * Where each hourly sample sits along the path, as a fraction of total length.
 *
 * The cursor is driven by `offset-distance`, which measures arc length, while
 * the readout switches on a plain time slot. Arc length is not linear in x —
 * a steep stretch of the curve carries more length per hour — so a cursor
 * moving at constant length ran ahead of its own label on the ramps and behind
 * it on the flats. The readout showed 16:00 while the dot sat around 13:00.
 * Emitting a keyframe per sample at its true arc-length fraction pins the two
 * together.
 */
function nodeArcFractions(pts) {
  const lengths = [0];
  let total = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const { p1, c1, c2, p2 } = segment(pts, i);
    let length = 0;
    let prev = p1;

    for (let step = 1; step <= 24; step++) {
      const t = step / 24;
      const u = 1 - t;
      const point = {
        x: u ** 3 * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * p2.x,
        y: u ** 3 * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * p2.y,
      };
      length += Math.hypot(point.x - prev.x, point.y - prev.y);
      prev = point;
    }

    total += length;
    lengths.push(total);
  }

  return lengths.map((length) => length / total);
}

/** Catmull-Rom through the samples, emitted as cubic beziers. */
function smoothPath(pts) {
  let d = `M${n(pts[0].x)} ${n(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${n(p1.x + (p2.x - p0.x) / 6)} ${n(p1.y + (p2.y - p0.y) / 6)}, ${n(p2.x - (p3.x - p1.x) / 6)} ${n(p2.y - (p3.y - p1.y) / 6)}, ${n(p2.x)} ${n(p2.y)}`;
  }
  return d;
}

/**
 * The same day curve, drawn to arbitrary bounds.
 *
 * Exported so the footer can close the page with the shape the hero opened
 * with, rather than an unrelated sine that happens to be wavy.
 */
export function dayCurvePath({ width, top, base, pad }) {
  const span = width - pad * 2;
  const pts = PROFILE.map((v, i) => ({
    x: pad + (i / (HOURS - 1)) * span,
    y: base - v * (base - top),
  }));
  return smoothPath(pts);
}

export function hero(profile) {
  const { name, role, location, github } = profile.identity;
  const pts = points();
  const curve = smoothPath(pts);
  const arcFractions = nodeArcFractions(pts);
  const area = `${curve} L${n(pts.at(-1).x)} ${BASE} L${n(pts[0].x)} ${BASE} Z`;

  const NAME_SIZE = 46;
  const SPACING = 8;
  const nameY = 126;
  // letter-spacing leaves a trailing gap after the last glyph, shifting a
  // middle-anchored run right by half a step; pull it back.
  const nameX = W / 2 - SPACING / 2;
  // The display face is not monospaced, so the run cannot be measured from an
  // advance width. Everything that has to cover the name is sized generously
  // and centred instead — the mask clips it to the glyphs either way.
  const NAME_BOX = 660;
  const shineTravel = NAME_BOX + 460;

  // Readout labels are fixed-width (HH:00 · NNN.NN), so one pill fits them all.
  const READ_SIZE = 10.5;
  const readW = 14 * READ_SIZE * ADVANCE + 20;

  // Slot boundaries are set in seconds (animation-delay) but slot widths in
  // percent (keyframe offsets). Rounded independently to 2dp those two land up
  // to ~5ms apart, and the slots stop tiling: a frame caught in the seam shows
  // two labels stacked on the same pill. Four decimals puts the disagreement
  // near a tenth of a millisecond — two orders of magnitude under a frame —
  // while staying a fixed-width decimal, so builds remain byte-stable.
  const fixed = (v) => Number(v.toFixed(4));
  const pct = (seconds) => fixed((seconds / CYCLE) * 100);

  // Each readout owns the stretch of the cycle in which its own sample is the
  // one nearest the cursor, so the label flips at the midpoint between two
  // hours — the way a crosshair snapping to the closest datapoint behaves. The
  // first and last slots also absorb the lead-in and the closing beat, so the
  // label is pinned to 00:00 and 23:00 exactly while the dot is parked there.
  const slotStart = (i) => (i === 0 ? 0 : LEAD + (i - 0.5) * STEP);
  const slotEnd = (i) => (i === HOURS - 1 ? CYCLE : LEAD + (i + 0.5) * STEP);

  const hourTicks = [0, 6, 12, 18]
    .map((i) => `${text(String(i).padStart(2, '0'), { x: n(pts[i].x), y: BASE + 16, size: 9, fill: color.dim, anchor: 'middle', spacing: 1.2 })}`)
    .join('');

  const gridX = [0, 6, 12, 18]
    .map((i) => `<line x1="${n(pts[i].x)}" y1="${TOP - 10}" x2="${n(pts[i].x)}" y2="${BASE}" stroke="${emerald[900]}" stroke-width="1" opacity="0.5"/>`)
    .join('');

  const readouts = PROFILE.map((v, i) => {
    const label = `${String(i).padStart(2, '0')}:00 · ${value(v).toFixed(2)}`;
    const shape = i === 0 ? 'vA' : i === HOURS - 1 ? 'vZ' : 'vM';
    // Every delay lands negative, so each readout is already mid-cycle at t=0
    // and exactly one of them is on screen from the first painted frame.
    return text(label, {
      x: 0,
      y: -20,
      size: READ_SIZE,
      fill: emerald[200],
      anchor: 'middle',
      cls: `v ${shape}`,
    }).replace('<text ', `<text style="animation-delay:${fixed(slotStart(i) - CYCLE)}s" `);
  }).join('');

  /**
   * A slot that opens at 0%, holds for `width` seconds, then stays shut.
   *
   * `step-end` on the element does the switching. Written the obvious way —
   * opacity 1 held to just before the boundary, then 0 — the two keyframes
   * cannot share a percentage (the later one would win outright and the slot
   * would cross-fade instead of cut), so it needs a sliver of a gap. At this
   * cycle length that sliver is ~5ms, which is under a frame but lands inside
   * one often enough to dim the label on roughly every third hour change.
   * A step function tiles the slots exactly instead: no gap, no overlap.
   */
  const slotFrames = (name, width) =>
    `@keyframes ${name}{0%{opacity:1}${pct(width)}%,100%{opacity:0}}`;

  const defs = `
<linearGradient id="nameGrad" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="${emerald[600]}"/>
  <stop offset="50%" stop-color="${emerald[300]}"/>
  <stop offset="100%" stop-color="${emerald[600]}"/>
</linearGradient>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
  <stop offset="50%" stop-color="#fff" stop-opacity="0.75"/>
  <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="${emerald[500]}" stop-opacity="0.32"/>
  <stop offset="100%" stop-color="${emerald[500]}" stop-opacity="0"/>
</linearGradient>
<radialGradient id="glow" cx="50%" cy="32%" r="62%">
  <stop offset="0%" stop-color="${emerald[500]}" stop-opacity="0.10"/>
  <stop offset="100%" stop-color="${emerald[500]}" stop-opacity="0"/>
</radialGradient>
<mask id="nameMask">
  <text x="${n(nameX)}" y="${nameY}" font-family="${display}" font-size="${NAME_SIZE}" font-weight="700" letter-spacing="${SPACING}" text-anchor="middle" fill="#fff">${esc(name)}</text>
</mask>
<path id="curve" d="${curve}"/>`;

  const style = `${ENTRANCE}
.d1{animation-delay:.1s}.d2{animation-delay:.22s}

/* Curve draws itself in; resting dashoffset is 0, i.e. fully drawn. */
.draw{stroke-dasharray:2600;animation:draw 2.2s cubic-bezier(.4,0,.2,1) .2s}
@keyframes draw{from{stroke-dashoffset:2600}}

/* Highlight parks off the left edge of the name at rest. */
.shimmer{animation:shimmer 7s ease-in-out 1.4s infinite}
@keyframes shimmer{0%,12%{transform:translateX(0)}62%,100%{transform:translateX(${n(shineTravel)}px)}}

/* CSS motion path, not SMIL, so reduced-motion pins the cursor at the start
   of the curve — exactly where the resting readout says it is.
   One keyframe per hour, placed at that hour's true arc-length fraction, so
   the dot and its readout stay on the same sample. */
.cursor{offset-path:path("${curve}");offset-rotate:0deg;animation:ride ${CYCLE}s linear infinite}
@keyframes ride{0%,${pct(LEAD)}%{offset-distance:0%}${arcFractions
    .slice(1)
    .map((fraction, k) => `${pct(LEAD + (k + 1) * STEP)}%{offset-distance:${n(fraction * 100)}%}`)
    .join('')}100%{offset-distance:100%}}

.v{opacity:0;animation-duration:${CYCLE}s;animation-timing-function:step-end;animation-iteration-count:infinite}
.vA{opacity:1;animation-name:slotA}
.vM{animation-name:slotM}
.vZ{animation-name:slotZ}
${slotFrames('slotA', slotEnd(0) - slotStart(0))}
${slotFrames('slotM', STEP)}
${slotFrames('slotZ', slotEnd(HOURS - 1) - slotStart(HOURS - 1))}

.pulse{animation:pulse 2.6s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`;

  const body = `
<rect width="${W}" height="${H}" rx="14" fill="${color.bg}"/>
<rect width="${W}" height="${H}" rx="14" fill="url(#glow)"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${color.border}"/>

<g class="fade">
  <line x1="1" y1="40" x2="${W - 1}" y2="40" stroke="${color.border}"/>
  <circle cx="${PAD}" cy="24.5" r="3.5" fill="${emerald[400]}" class="pulse"/>
  ${text(`github.com/${github}`, { x: PAD + 13, y: 28.5, size: 11, fill: color.muted, spacing: 1.6 })}
  ${text(location, { x: W - PAD, y: 28.5, size: 11, fill: color.muted, anchor: 'end', spacing: 1.6 })}
</g>

<g class="fade d1">
  <g mask="url(#nameMask)">
    <rect x="${n(W / 2 - NAME_BOX / 2)}" y="${nameY - NAME_SIZE}" width="${NAME_BOX}" height="${NAME_SIZE + 16}" fill="url(#nameGrad)"/>
    <rect class="shimmer" x="${n(W / 2 - NAME_BOX / 2 - 240)}" y="${nameY - NAME_SIZE}" width="180" height="${NAME_SIZE + 16}" fill="url(#shine)"/>
  </g>
  ${text(role, { x: W / 2, y: 160, size: 14, fill: color.text, anchor: 'middle', spacing: 3.6 })}
</g>

<g class="fade d2">
  ${gridX}
  <line x1="${PAD}" y1="${BASE}" x2="${W - PAD}" y2="${BASE}" stroke="${color.border}"/>
  <path d="${area}" fill="url(#areaFill)"/>
  <use href="#curve" fill="none" stroke="${emerald[400]}" stroke-width="2" stroke-linecap="round" class="draw"/>
  ${hourTicks}

  <g class="cursor">
    <line x1="0" y1="0" x2="0" y2="-8" stroke="${emerald[300]}" stroke-width="1" opacity="0.5"/>
    <rect x="${n(-readW / 2)}" y="-32" width="${n(readW)}" height="19" rx="5" fill="${color.raised}" stroke="${emerald[800]}"/>
    ${readouts}
    <circle r="3.2" fill="#d1fae5"/>
  </g>
</g>
`;

  return doc({ width: W, height: H, title: `${name} — ${role}`, defs, style, body });
}

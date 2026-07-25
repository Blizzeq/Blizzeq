// Tech stack, grouped and auto-laid-out.
//
// Chip tone carries information: `strong` marks the tools used daily, `quiet`
// the ones that show up in side projects. The previous hand-written asset had
// every coordinate hard-coded and every chip shouting equally.

import { color } from '../lib/tokens.mjs';
import { doc, panel, caption, chipRows, ENTRANCE } from '../lib/svg.mjs';

const W = 1000;
const PAD = 30;
const TOP = 34;
const GROUP_GAP = 30;

export function stack(profile) {
  let y = TOP;
  let body = '';
  let delay = 0;

  for (const group of profile.stack) {
    body += caption(group.group, { cx: W / 2, y });
    y += 16;
    const rows = chipRows(group.items, {
      cx: W / 2,
      y,
      maxW: W - PAD * 2,
      size: 12,
      delayBase: delay,
      stagger: 0.035,
    });
    body += rows.svg;
    y += rows.height + GROUP_GAP;
    delay += 0.12;
  }

  const H = y - GROUP_GAP + PAD;

  const style = `${ENTRANCE}
/* Chips settle in with a short stagger; resting state is in place and opaque. */
.chip{transform-box:fill-box;transform-origin:center;animation:pop .5s cubic-bezier(.2,.8,.2,1)}
@keyframes pop{from{transform:scale(.9);opacity:0}}`;

  return doc({
    width: W,
    height: H,
    title: 'Tech stack',
    style,
    body: `${panel(W, H)}<g>${body}</g>`,
  });
}

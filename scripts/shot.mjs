#!/usr/bin/env node
// Render assets to PNG for visual QA.
//
// Each SVG is wrapped in an <img> tag before screenshotting, because that is
// how GitHub embeds it: no scripts, no external fetches. Rendering the .svg
// file directly would be a more permissive environment than the real one.
//
//   node scripts/shot.mjs hero.svg                  → .qa/hero.png
//   node scripts/shot.mjs --time 6000 hero.svg      → advance animations 6s
//   node scripts/shot.mjs --all                     → every asset, stacked
//
// Chrome's virtual time budget advances animation clocks deterministically, so
// the same command always produces the same frame.

import { readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const timeIdx = argv.indexOf('--time');
const budget = timeIdx >= 0 ? Number(argv[timeIdx + 1]) : 4000;
const width = argv.includes('--mobile') ? 420 : 1040;
const args = argv.filter((a, i) => !a.startsWith('--') && i !== timeIdx + 1);

let files = args;
if (argv.includes('--all') || files.length === 0) {
  files = (await readdir(join(root, 'assets'))).filter((f) => f.endsWith('.svg')).sort();
}

const qa = join(root, '.qa');
await mkdir(qa, { recursive: true });

const light = argv.includes('--light');
const page = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:16px;background:${light ? '#ffffff' : '#0d1117'};
       font:11px ui-monospace,monospace;color:${light ? '#57606a' : '#6b7280'}}
  figure{margin:0 0 18px}figcaption{margin-bottom:5px}
  img{max-width:100%;display:block}
</style>${files.map((f) => `<figure><figcaption>${f}</figcaption><img src="../assets/${f}"></figure>`).join('')}`;

const tmp = join(qa, '_page.html');
await writeFile(tmp, page);

const out = join(qa, argv.includes('--all') || args.length !== 1 ? 'all.png' : `${args[0].replace(/\.svg$/, '')}.png`);

// --static forces prefers-reduced-motion inside the embedded SVGs, which pins
// every animation to its resting state. That is the frame worth reviewing:
// it is what a reduced-motion visitor sees, and — because each animation is
// authored to rest in its finished state — also the composed final look,
// without depending on where a virtual clock happened to stop.
await run(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  ...(argv.includes('--static') ? ['--force-prefers-reduced-motion'] : []),
  `--window-size=${width},900`,
  `--virtual-time-budget=${budget}`,
  `--screenshot=${out}`,
  tmp,
]);

await rm(tmp, { force: true });
console.log(`→ ${out.replace(root, '.')}  (t=${budget}ms, w=${width}px)`);

#!/usr/bin/env node
// Generates every image the profile README uses.
//
// Nothing here talks to a third-party image service at render time: the README
// only ever points at files committed in this repo, so it cannot break because
// somebody else's deployment went down. That is the whole reason this exists —
// the previous README lost its project cards and stats card to a 503 from a
// public github-readme-stats instance.

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { hero } from './cards/hero.mjs';
import { terminal } from './cards/terminal.mjs';
import { stats as statsCard } from './cards/stats.mjs';
import { badge } from './cards/contact.mjs';
import { fetchAll } from './lib/github.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const cachePath = join(root, 'data', 'github-cache.json');

const profile = JSON.parse(await readFile(join(root, 'data', 'profile.json'), 'utf8'));

async function loadStats() {
  try {
    const data = await fetchAll();
    await writeFile(cachePath, `${JSON.stringify(data, null, 2)}\n`);
    console.log('· github: fetched live');
    return data;
  } catch (err) {
    if (existsSync(cachePath)) {
      console.warn(`· github: ${err.message}\n  falling back to committed cache`);
      return JSON.parse(await readFile(cachePath, 'utf8'));
    }
    throw new Error(`No GitHub data and no cache to fall back on: ${err.message}`);
  }
}

const written = [];
async function emit(name, svg) {
  await writeFile(join(assets, name), svg);
  written.push({ name, bytes: svg.length, hash: createHash('sha256').update(svg).digest('hex').slice(0, 8) });
}

/**
 * Stamp every asset URL with a hash of that asset's own bytes.
 *
 * GitHub serves README images through its camo proxy, which caches by URL.
 * These URLs are stable filenames, so a regenerated asset can keep rendering
 * the *old* picture long after the new bytes are committed — the fix is on
 * GitHub, the reader still sees the bug. That is not hypothetical: it is how
 * the cursor timing fix landed, verified correct in the file and in a browser,
 * and still wrong on the profile page.
 *
 * A content hash gives changed assets a new URL, so camo has to fetch them,
 * while assets that did not change keep their URL and their cache entry. The
 * build stays deterministic, so this adds no churn on its own.
 */
function stamp(markup) {
  const hashes = new Map(written.map((w) => [w.name, w.hash]));
  return markup.replace(/(?:src|srcset)="((?:\.\.\/)?assets\/)([\w.-]+\.svg)"/g, (whole, dir, file) => {
    const hash = hashes.get(file);
    return hash ? whole.replace(`${dir}${file}`, `${dir}${file}?v=${hash}`) : whole;
  });
}

await mkdir(assets, { recursive: true });
const data = await loadStats();

await emit('hero.svg', hero(profile));
await emit('about-terminal.svg', terminal(profile));
await emit('about-terminal-narrow.svg', terminal(profile, 'narrow'));

await emit('stats.svg', statsCard(data));
await emit('stats-narrow.svg', statsCard(data, 'narrow'));

const { linkedin, linkedinLabel, email } = profile.identity;
const contacts = [
  { file: 'contact-linkedin.svg', icon: 'linkedin', label: linkedinLabel, title: 'LinkedIn', href: `https://www.linkedin.com/in/${linkedin}/` },
  { file: 'contact-email.svg', icon: 'mail', label: email, title: 'Email', href: `mailto:${email}` },
];
for (const c of contacts) await emit(c.file, badge(c));

// The README is generated too, so the card files, links and group headings can
// never drift from data/profile.json — editing that one file is the whole
// maintenance story.
await writeFile(join(root, 'README.md'), stamp(readme()));

// A review page mirroring the README layout, so what gets checked locally is
// what ships. Regenerated on every build so it cannot go stale.
await writeFile(join(root, 'scripts', 'preview.html'), stamp(previewPage()));

// Drop assets this build no longer produces, so renaming or removing a project
// cannot leave an orphan file behind that the README quietly stops using.
const keep = new Set(written.map((w) => w.name));
for (const file of await readdir(assets)) {
  if (file.endsWith('.svg') && !keep.has(file)) {
    await rm(join(assets, file));
    console.log(`· removed stale asset: ${file}`);
  }
}

for (const { name, bytes } of written) {
  console.log(`  ${name.padEnd(40)} ${(bytes / 1024).toFixed(1)} kB`);
}
const total = written.reduce((s, w) => s + w.bytes, 0);
console.log(`\n${written.length} assets · ${(total / 1024).toFixed(0)} kB total`);

function readme() {
  return `<div align="center">

<img src="assets/hero.svg" alt="Jakub Krasuski — ${profile.identity.role}" />

</div>

<h2 align="center">About</h2>

<div align="center">

<picture><source media="(max-width: 700px)" srcset="assets/about-terminal-narrow.svg" /><img src="assets/about-terminal.svg" alt="Terminal session: whoami, current work, core stack, after-hours projects" /></picture>

</div>

<h2 align="center">GitHub Activity</h2>

<div align="center">

<picture><source media="(max-width: 700px)" srcset="assets/stats-narrow.svg" /><img src="assets/stats.svg" alt="Contributions, repositories touched, public repositories, and years on GitHub" /></picture>

</div>

<h2 align="center">Contact</h2>

<div align="center">

${contacts.map((c) => `<a href="${c.href}"><img src="assets/${c.file}" alt="${c.title}" /></a>`).join('\n')}

</div>
`;
}

function previewPage() {
  const img = (f, cls = '') => `<img class="${cls}" src="../assets/${f}" alt="${f}">`;
  const mobile = `<div class="phone">
    ${img('about-terminal-narrow.svg')}
    ${img('stats-narrow.svg')}
    <div class="row contacts">${contacts.map((c) => img(c.file)).join('')}</div>
  </div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Profile assets — review</title>
<meta http-equiv="refresh" content="30">
<style>
  :root{color-scheme:dark}
  body{margin:0;padding:28px 20px 80px;background:#0d1117;color:#e6edf3;
       font:13px ui-monospace,SFMono-Regular,Menlo,monospace}
  .wrap{max-width:1000px;margin:0 auto}
  .bar{display:flex;justify-content:space-between;align-items:center;
       font-size:11px;color:#6b7280;letter-spacing:1.5px;margin-bottom:22px}
  h2{font-size:12px;letter-spacing:2.5px;color:#8b949e;font-weight:400;
     text-transform:uppercase;margin:40px 0 12px;padding-bottom:8px;
     border-bottom:1px solid #21262d}
  img{display:block;max-width:100%;margin-bottom:14px}
  .row{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
  .row img{margin-bottom:0}
  .light{background:#fff;padding:24px;border-radius:12px;margin-top:56px}
  .light h2{color:#57606a;border-color:#d0d7de}
  .mobile-grid{display:flex;gap:24px;align-items:flex-start;justify-content:center;flex-wrap:wrap}
  .phone{box-sizing:content-box;width:400px;padding:18px;background:#0d1117;border:1px solid #30363d;border-radius:16px}
  .phone.light-phone{background:#fff;border-color:#d0d7de}
  .phone img{width:100%;margin-bottom:14px}
  .phone .contacts{justify-content:center}
  .phone .contacts img{width:auto;margin-bottom:0}
  .note{font-size:11px;color:#6b7280;margin:6px 0 18px;letter-spacing:.4px}
</style></head><body><div class="wrap">

<div class="bar"><span>PROFILE ASSETS — REVIEW</span><span>auto-refresh 30 s</span></div>
<p class="note">Rendered through &lt;img&gt;, the same way GitHub embeds them: no scripts, no external requests.</p>

<h2>Hero</h2>${img('hero.svg')}
<h2>About</h2>${img('about-terminal.svg')}
<h2>GitHub activity</h2>${img('stats.svg')}
<h2>Contact</h2><div class="row" style="justify-content:center">${contacts.map((c) => `<img style="width:auto" src="../assets/${c.file}" alt="${c.title}">`).join('')}</div>

<h2>Mobile assets — dark and light GitHub themes</h2>
<div class="mobile-grid">${mobile}${mobile.replace('class="phone"', 'class="phone light-phone"')}</div>

<div class="light">
  <div class="bar"><span style="color:#57606a">SAME ASSETS ON WHITE — GITHUB LIGHT THEME</span></div>
  ${img('hero.svg')}
  ${img('about-terminal.svg')}
  ${img('stats.svg')}
  <div class="row" style="justify-content:center">${contacts.map((c) => `<img style="width:auto" src="../assets/${c.file}" alt="${c.title}">`).join('')}</div>
</div>

</div></body></html>
`;
}

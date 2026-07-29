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
import { projectCard, ctaButton } from './cards/project.mjs';
import { stack } from './cards/stack.mjs';
import { stats as statsCard } from './cards/stats.mjs';
import { badge, footer } from './cards/contact.mjs';
import { fetchAll } from './lib/github.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const cachePath = join(root, 'data', 'github-cache.json');

const profile = JSON.parse(await readFile(join(root, 'data', 'profile.json'), 'utf8'));

/** Every featured repo, in README order. */
export function featuredRepos(p) {
  return [p.flagship, ...p.projectGroups.flatMap((g) => [...(g.projects ?? []), ...(g.compact ?? [])])];
}

async function loadStats() {
  try {
    const data = await fetchAll(featuredRepos(profile));
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
  return markup.replace(/src="((?:\.\.\/)?assets\/)([\w.-]+\.svg)"/g, (whole, dir, file) => {
    const hash = hashes.get(file);
    return hash ? `src="${dir}${file}?v=${hash}"` : whole;
  });
}

await mkdir(assets, { recursive: true });
const data = await loadStats();

await emit('hero.svg', hero(profile));
await emit('about-terminal.svg', terminal(profile));

const CARD_W = { hero: 1000, std: 492, compact: 325 };

/**
 * Emit a card plus the strip beneath it.
 *
 * The card goes to the live demo when there is one — that is what the badge
 * drawn on it promises, and a link inside an SVG does nothing once GitHub
 * embeds it through <img>. The strip carries the repository link, so both
 * destinations stay reachable and every row keeps the same shape.
 */
async function emitProject(repo, variant) {
  const project = profile.projects[repo];
  const prefix = variant === 'compact' ? 'card-sm' : 'card';
  const file = `${prefix}-${repo}.svg`;
  const cta = `${prefix}-${repo}-cta.svg`;
  const url = `https://github.com/Blizzeq/${repo}`;

  await emit(file, projectCard(repo, project, data, variant));
  await emit(cta, ctaButton({ width: CARD_W[variant], label: 'view code' }));

  return { file, cta, repo, href: project.demo ?? url, ctaHref: url };
}

// One full-width flagship, then groups of exactly two half cards, so no row is
// ever left with a hole in it.
const flagship = await emitProject(profile.flagship, 'hero');

const layout = [];
for (const group of profile.projectGroups) {
  const entry = { title: group.title, cards: [], compact: [] };

  for (const repo of group.projects ?? []) {
    entry.cards.push(await emitProject(repo, 'std'));
  }
  for (const repo of group.compact ?? []) {
    entry.compact.push(await emitProject(repo, 'compact'));
  }

  layout.push(entry);
}

await emit('tech-stack.svg', stack(profile));
await emit('stats.svg', statsCard(profile, data, featuredRepos(profile).length));

const { linkedin, linkedinLabel, email, github } = profile.identity;
const contacts = [
  { file: 'contact-linkedin.svg', icon: 'linkedin', label: linkedinLabel, title: 'LinkedIn', href: `https://www.linkedin.com/in/${linkedin}/` },
  { file: 'contact-email.svg', icon: 'mail', label: email, title: 'Email', href: `mailto:${email}` },
  { file: 'contact-github.svg', icon: 'github', label: github, title: 'GitHub', href: `https://github.com/${github}` },
];
for (const c of contacts) await emit(c.file, badge(c));

await emit('footer.svg', footer(profile.identity.tagline));

// The README is generated too, so the card files, links and group headings can
// never drift from data/profile.json — editing that one file is the whole
// maintenance story.
await writeFile(join(root, 'README.md'), stamp(readme(layout)));

// A review page mirroring the README layout, so what gets checked locally is
// what ships. Regenerated on every build so it cannot go stale.
await writeFile(join(root, 'scripts', 'preview.html'), stamp(previewPage(layout)));

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

function readme(groups) {
  const USER = 'Blizzeq';
  const p = (c) => profile.projects[c.repo];
  const card = (c) =>
    `<a href="${c.href}"><img width="100%" src="assets/${c.file}" alt="${p(c).display} — ${p(c).pitch}" /></a>`;
  const cta = (c) =>
    `<a href="${c.ctaHref}"><img width="100%" src="assets/${c.cta}" alt="${p(c).display} source code" /></a>`;

  /**
   * Project grid, laid out as a table.
   *
   * The obvious spelling — floating images at `width="49%"` and letting them
   * wrap — is a knife edge. Two of them come to 98%, but they are inline, so
   * the whitespace between them counts too. On a phone GitHub's README column
   * is about 293px wide: the pair measures 288px and the gap about 4.4px,
   * leaving 0.6px of slack. Whether that fits comes down to how one browser
   * rounds a fractional pixel, which is why the same README looked right on
   * one device and came apart on the next — cards dropped onto separate rows
   * at half width, and the "view code" strips piled up under the wrong cards.
   *
   * A table has no such margin of error. Each cell holds a card together with
   * its own strip, so the two cannot be separated at any width, and the
   * columns divide the row rather than competing for it.
   */
  const grid = (cards, perRow) => {
    const rows = [];
    for (let i = 0; i < cards.length; i += perRow) rows.push(cards.slice(i, i + perRow));
    const width = `${Math.floor(100 / perRow)}%`;
    const cell = (c) => `<td width="${width}" valign="top" align="center">

${card(c)}
${cta(c)}

</td>`;
    // Pad the final row so a lone card keeps its column width instead of
    // stretching across the table.
    const pad = (row) => [...row, ...Array(perRow - row.length).fill(null)];
    const tr = (row) => `<tr>
${pad(row).map((c) => (c ? cell(c) : `<td width="${width}"></td>`)).join('\n')}
</tr>`;
    return `<table>
${rows.map(tr).join('\n')}
</table>`;
  };

  const group = (g) => `<h3 align="center">${g.title}</h3>

<div align="center">

${grid(g.cards, 2)}${g.compact.length ? `\n\n${grid(g.compact, 3)}` : ''}

</div>`;

  return `<div align="center">

<img src="assets/hero.svg" alt="Jakub Krasuski — ${profile.identity.role}" />

</div>

<h2 align="center">About</h2>

<div align="center">

<img src="assets/about-terminal.svg" alt="Terminal session: whoami, current work, core stack, after-hours projects" />

</div>

<h2 align="center">Featured Projects</h2>

<div align="center">

<a href="${flagship.href}"><img src="assets/${flagship.file}" alt="${profile.projects[profile.flagship].display} — ${profile.projects[profile.flagship].pitch}" /></a>
<a href="${flagship.ctaHref}"><img src="assets/${flagship.cta}" alt="${profile.projects[profile.flagship].display} source code" /></a>

</div>

${groups.map(group).join('\n\n')}

<h2 align="center">Tech Stack</h2>

<div align="center">

<img src="assets/tech-stack.svg" alt="Tech stack grouped by how often each tool is used" />

</div>

<h2 align="center">GitHub Activity</h2>

<div align="center">

<img src="assets/stats.svg" alt="Contributions, repositories touched, public repositories, years on GitHub, and language mix" />

<img src="https://raw.githubusercontent.com/${USER}/${USER}/output/profile-3d-emerald.svg" alt="3D contribution calendar" />

</div>

<h2 align="center">Contact</h2>

<div align="center">

${contacts.map((c) => `<a href="${c.href}"><img src="assets/${c.file}" alt="${c.title}" /></a>`).join('\n')}

</div>

<div align="center">

<img src="assets/footer.svg" alt="" />

</div>
`;
}

function previewPage(groups) {
  const img = (f, cls = '') => `<img class="${cls}" src="../assets/${f}" alt="${f}">`;
  const pair = (c, cls) => `<div class="${cls}">${img(c.file)}${img(c.cta)}</div>`;
  const section = (g) => `
  <h2>${g.title}</h2>
  <div class="row">${g.cards.map((c) => pair(c, 'half')).join('')}</div>
  ${g.compact.length ? `<div class="row" style="margin-top:14px">${g.compact.map((c) => pair(c, 'third')).join('')}</div>` : ''}`;

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
  .half{width:calc(50% - 7px)}
  .third{width:calc(33.333% - 10px)}
  .half img,.third img{width:100%}
  .half img+img,.third img+img{margin-top:8px}
  .light{background:#fff;padding:24px;border-radius:12px;margin-top:56px}
  .light h2{color:#57606a;border-color:#d0d7de}
  .note{font-size:11px;color:#6b7280;margin:6px 0 18px;letter-spacing:.4px}
</style></head><body><div class="wrap">

<div class="bar"><span>PROFILE ASSETS — REVIEW</span><span>auto-refresh 30 s</span></div>
<p class="note">Rendered through &lt;img&gt;, the same way GitHub embeds them: no scripts, no external requests.</p>

<h2>Hero</h2>${img('hero.svg')}
<h2>About</h2>${img('about-terminal.svg')}
<h2>Featured</h2>${img(flagship.file)}${img(flagship.cta)}
${groups.map(section).join('\n')}
<h2>Tech stack</h2>${img('tech-stack.svg')}
<h2>GitHub activity</h2>${img('stats.svg')}
<h2>Contact</h2><div class="row" style="justify-content:center">${contacts.map((c) => `<img style="width:auto" src="../assets/${c.file}" alt="${c.title}">`).join('')}</div>
${img('footer.svg')}

<div class="light">
  <div class="bar"><span style="color:#57606a">SAME ASSETS ON WHITE — GITHUB LIGHT THEME</span></div>
  ${img('hero.svg')}
  <div class="row">${groups[1].cards.map((c) => img(c.file, 'half')).join('')}</div>
  ${img('stats.svg')}
</div>

</div></body></html>
`;
}

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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { hero } from './cards/hero.mjs';
import { terminal } from './cards/terminal.mjs';
import { projectCard } from './cards/project.mjs';
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
  written.push({ name, bytes: svg.length });
}

await mkdir(assets, { recursive: true });
const data = await loadStats();

await emit('hero.svg', hero(profile));
await emit('about-terminal.svg', terminal(profile));

// One full-width flagship, then groups of exactly two half cards, so no row is
// ever left with a hole in it.
const flagshipFile = `card-${profile.flagship}.svg`;
await emit(flagshipFile, projectCard(profile.flagship, profile.projects[profile.flagship], data, 'hero'));

const layout = [];
for (const group of profile.projectGroups) {
  const entry = { title: group.title, cards: [], compact: [] };

  for (const repo of group.projects ?? []) {
    const file = `card-${repo}.svg`;
    await emit(file, projectCard(repo, profile.projects[repo], data, 'std'));
    entry.cards.push({ file, repo, href: `https://github.com/Blizzeq/${repo}` });
  }

  for (const repo of group.compact ?? []) {
    const file = `card-sm-${repo}.svg`;
    await emit(file, projectCard(repo, profile.projects[repo], data, 'compact'));
    entry.compact.push({ file, repo, href: `https://github.com/Blizzeq/${repo}` });
  }

  layout.push(entry);
}

await emit('tech-stack.svg', stack(profile));
await emit('stats.svg', statsCard(profile, data));

const { linkedin, linkedinLabel, email, github } = profile.identity;
const contacts = [
  { file: 'contact-linkedin.svg', icon: 'linkedin', label: linkedinLabel, title: 'LinkedIn', href: `https://www.linkedin.com/in/${linkedin}/` },
  { file: 'contact-email.svg', icon: 'mail', label: email, title: 'Email', href: `mailto:${email}` },
  { file: 'contact-github.svg', icon: 'github', label: github, title: 'GitHub', href: `https://github.com/${github}` },
];
for (const c of contacts) await emit(c.file, badge(c));

await emit('footer.svg', footer());

// The README is generated too, so the card files, links and group headings can
// never drift from data/profile.json — editing that one file is the whole
// maintenance story.
await writeFile(join(root, 'README.md'), readme(layout));

// A review page mirroring the README layout, so what gets checked locally is
// what ships. Regenerated on every build so it cannot go stale.
await writeFile(join(root, 'scripts', 'preview.html'), previewPage(layout));

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
  const card = (c, width) =>
    `<a href="${c.href}"><img width="${width}" src="assets/${c.file}" alt="${profile.projects[c.repo].display} — ${profile.projects[c.repo].pitch}" /></a>`;

  const group = (g) => `<h3 align="center">${g.title}</h3>

<div align="center">

${g.cards.map((c) => card(c, '49%')).join('\n')}

</div>${g.compact.length
      ? `

<div align="center">

${g.compact.map((c) => card(c, '32%')).join('\n')}

</div>`
      : ''}`;

  return `<div align="center">

<img src="assets/hero.svg" alt="Jakub Krasuski — ${profile.identity.role}" />

</div>

<h2 align="center">About</h2>

<div align="center">

<img src="assets/about-terminal.svg" alt="Terminal session: whoami, current work, core stack, after-hours projects" />

</div>

<h2 align="center">Featured Projects</h2>

<div align="center">

<a href="https://github.com/${USER}/${profile.flagship}"><img src="assets/card-${profile.flagship}.svg" alt="${profile.projects[profile.flagship].display} — ${profile.projects[profile.flagship].pitch}" /></a>

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
  const section = (g) => `
  <h2>${g.title}</h2>
  <div class="row">${g.cards.map((c) => img(c.file, 'half')).join('')}</div>
  ${g.compact.length ? `<div class="row" style="margin-top:14px">${g.compact.map((c) => img(c.file, 'third')).join('')}</div>` : ''}`;

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
  .row{display:flex;gap:14px;flex-wrap:wrap}
  .row img{margin-bottom:0}
  .half{width:calc(50% - 7px)}
  .third{width:calc(33.333% - 10px)}
  .light{background:#fff;padding:24px;border-radius:12px;margin-top:56px}
  .light h2{color:#57606a;border-color:#d0d7de}
  .note{font-size:11px;color:#6b7280;margin:6px 0 18px;letter-spacing:.4px}
</style></head><body><div class="wrap">

<div class="bar"><span>PROFILE ASSETS — REVIEW</span><span>auto-refresh 30 s</span></div>
<p class="note">Rendered through &lt;img&gt;, the same way GitHub embeds them: no scripts, no external requests.</p>

<h2>Hero</h2>${img('hero.svg')}
<h2>About</h2>${img('about-terminal.svg')}
<h2>Featured</h2>${img(flagshipFile)}
${groups.map(section).join('\n')}
<h2>Tech stack</h2>${img('tech-stack.svg')}
<h2>GitHub activity</h2>${img('stats.svg')}
<h2>Contact</h2><div class="row">${contacts.map((c) => `<img style="width:auto" src="../assets/${c.file}" alt="${c.title}">`).join('')}</div>
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

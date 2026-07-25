// Design tokens — the single source of truth for the whole profile.
// Every generated SVG pulls its colours, type sizes and spacing from here.

export const color = {
  bg: '#0d1117',
  surface: '#161b22',
  raised: '#1c2128',
  border: '#30363d',
  borderSoft: '#21262d',
  text: '#e6edf3',
  muted: '#8b949e',
  dim: '#6b7280',
};

export const emerald = {
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#064e3b',
};

// Monospace everywhere. Two reasons: it matches the power-systems / terminal
// concept, and it makes layout deterministic without embedding a font — an SVG
// loaded through <img> on GitHub cannot fetch a webfont, so anything else would
// render differently per platform.
export const font =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono','DejaVu Sans Mono',monospace";

// Widest common monospace advance ratio. Consolas (Windows) is narrower at
// ~0.55, so boxes sized with this value never clip — text just gains a little
// breathing room. Always pair with text-anchor="middle" so the difference
// stays symmetric.
export const ADVANCE = 0.6;

/** Rendered width of `text` at `size`px in the monospace stack. */
export const textWidth = (text, size) => text.length * size * ADVANCE;

export const radius = { sm: 6, md: 10, lg: 14 };

// Language colours.
//
// Not linguist's palette: its TypeScript (#3178c6) and Python (#3572A5) are
// both mid-blue and turned the stacked bar into one indistinguishable smear.
// These keep clear separation, sit inside the emerald identity, and give
// Python — the language of the day job — the accent colour.
export const langColor = {
  Python: '#34d399',
  TypeScript: '#3b82f6',
  JavaScript: '#fbbf24',
  CSS: '#a78bfa',
  HTML: '#fb7185',
  'Jupyter Notebook': '#f97316',
  Shell: '#94a3b8',
  Other: '#6b7280',
};

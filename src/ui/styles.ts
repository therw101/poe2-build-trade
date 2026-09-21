// Styles live in TS strings: they are injected into shadow roots and a page <style>,
// and WXT 0.21 + Vite 8 cannot bundle `?inline` CSS imports in content scripts.

export const TOKENS_CSS = `
/* Shared design tokens. Accent hue follows PoE's gold UI; neutrals are a warm-dark ramp. */
:host,
.b2t-root {
  --b2t-accent-h: 80;
  --b2t-accent: oklch(0.78 0.11 var(--b2t-accent-h));
  --b2t-accent-strong: oklch(0.86 0.13 var(--b2t-accent-h));
  --b2t-accent-dim: oklch(0.45 0.07 var(--b2t-accent-h));

  --b2t-bg: oklch(0.17 0.008 70);
  --b2t-surface: oklch(0.21 0.01 70);
  --b2t-surface-2: oklch(0.25 0.012 70);
  --b2t-border: oklch(0.33 0.014 70);
  --b2t-text: oklch(0.92 0.01 80);
  --b2t-text-dim: oklch(0.68 0.012 80);
  --b2t-text-faint: oklch(0.52 0.01 80);

  --b2t-magic: oklch(0.7 0.12 265);
  --b2t-rare: oklch(0.86 0.14 95);
  --b2t-unique: oklch(0.68 0.13 55);
  --b2t-normal: oklch(0.85 0.005 80);
  --b2t-danger: oklch(0.68 0.16 28);
}
`;

export const POPUP_CSS = `
:host {
  all: initial;
  position: fixed;
  z-index: 2147483646;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
}

* {
  box-sizing: border-box;
}

.panel {
  width: 380px;
  max-height: min(560px, calc(100vh - 16px));
  display: flex;
  flex-direction: column;
  background: var(--b2t-bg);
  color: var(--b2t-text);
  border: 1px solid var(--b2t-border);
  border-radius: 6px;
  box-shadow: 0 12px 32px oklch(0 0 0 / 0.55);
  overflow: hidden;
}

header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 12px;
  background: var(--b2t-surface);
  border-bottom: 1px solid var(--b2t-border);
}

.rarity {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rarity-rare { color: var(--b2t-rare); }
.rarity-magic { color: var(--b2t-magic); }
.rarity-unique { color: var(--b2t-unique); }
.rarity-normal { color: var(--b2t-normal); }

.title {
  flex: 1;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

button {
  font: inherit;
  cursor: pointer;
}

.close {
  background: none;
  border: 0;
  color: var(--b2t-text-dim);
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
}
.close:hover { color: var(--b2t-text); background: var(--b2t-surface-2); }

.body {
  overflow-y: auto;
  padding: 4px 12px 8px;
}

.banner {
  margin: 8px 0 0;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--b2t-surface-2);
  color: var(--b2t-text);
  font-size: 12px;
}
.banner a { color: var(--b2t-accent-strong); margin-left: 6px; }

h3 {
  margin: 12px 0 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--b2t-text-faint);
}

.base {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}

.row {
  display: grid;
  grid-template-columns: 18px 1fr 64px;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid oklch(0.25 0.01 70 / 0.6);
}
.row:last-child { border-bottom: 0; }

.row .text {
  text-wrap: pretty;
  color: var(--b2t-text);
}
.row.unchecked .text { color: var(--b2t-text-dim); }
.row.unmapped .text { color: var(--b2t-text-faint); }
.row .na {
  font-size: 11px;
  color: var(--b2t-text-faint);
  text-align: right;
}

label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

input[type='checkbox'],
input[type='radio'] {
  margin: 0;
  accent-color: var(--b2t-accent);
  width: 14px;
  height: 14px;
}

input[type='number'],
select {
  width: 100%;
  padding: 3px 6px;
  font: inherit;
  color: var(--b2t-text);
  background: var(--b2t-surface);
  border: 1px solid var(--b2t-border);
  border-radius: 4px;
}
input[type='number']:disabled { opacity: 0.4; }
input:focus-visible,
select:focus-visible,
button:focus-visible {
  outline: 2px solid var(--b2t-accent);
  outline-offset: 1px;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 12px;
}
.controls select { width: auto; }
.controls input[type='number'] { width: 56px; }

footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--b2t-surface);
  border-top: 1px solid var(--b2t-border);
}
.league {
  flex: 1;
  font-size: 12px;
  color: var(--b2t-text-dim);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search {
  padding: 6px 14px;
  font-weight: 600;
  color: oklch(0.18 0.02 80);
  background: var(--b2t-accent);
  border: 1px solid var(--b2t-accent-strong);
  border-radius: 4px;
}
.search:hover { background: var(--b2t-accent-strong); }
.search:active { transform: translateY(1px); }
`;

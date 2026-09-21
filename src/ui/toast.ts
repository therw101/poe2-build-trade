import { t } from '../ext/i18n.ts';
import { h } from './dom.ts';
import { TOKENS_CSS } from './styles.ts';

const CSS = `
:host { all: initial; position: fixed; z-index: 2147483647; font-family: inherit; font-size: 12px; line-height: 1.4; }
.toast {
  display: flex; align-items: center; gap: 10px; max-width: 320px; padding: 8px 10px;
  color: var(--b2t-text); background: var(--b2t-bg);
  border: 1px solid var(--b2t-danger); border-radius: 6px;
  box-shadow: 0 8px 24px oklch(0 0 0 / 0.5);
}
button {
  font: inherit; cursor: pointer; padding: 3px 8px; border-radius: 4px;
  color: var(--b2t-text); background: var(--b2t-surface-2); border: 1px solid var(--b2t-border);
}
button:hover { border-color: var(--b2t-accent); }
`;

let current: HTMLElement | null = null;

/** Small error message next to the clicked button, with an optional Retry. */
export function showToast(anchor: HTMLElement, message: string, retry?: () => void): void {
  current?.remove();
  const host = h('div', { role: 'alert' });
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = TOKENS_CSS + CSS;
  const dismiss = () => {
    host.remove();
    if (current === host) current = null;
  };
  root.append(
    style,
    h(
      'div',
      { class: 'toast' },
      h('span', {}, message),
      retry
        ? h('button', { type: 'button', onclick: () => (dismiss(), retry()) }, t('retry'))
        : null,
    ),
  );
  document.body.append(host);
  const a = anchor.getBoundingClientRect();
  host.style.left = `${Math.max(8, Math.min(a.left, innerWidth - 336))}px`;
  host.style.top = `${Math.min(a.bottom + 6, innerHeight - 60)}px`;
  current = host;
  setTimeout(dismiss, 6000);
}

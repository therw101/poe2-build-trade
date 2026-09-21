import { INJECTED_ATTR, findTargets, getItem, type ItemResult, type Target } from '../src/adapters/maxroll.ts';
import { tradeUrl } from '../src/core/encode.ts';
import { buildDirectQuery, buildQuery } from '../src/core/query.ts';
import type { TradeQuery } from '../src/core/types.ts';
import { t } from '../src/ext/i18n.ts';
import { sendMessage, type ErrorCode } from '../src/ext/messages.ts';
import { getSettings } from '../src/ext/settings.ts';
import { SEARCH_ICON, h } from '../src/ui/dom.ts';
import { closePopup, openPopup } from '../src/ui/popup.ts';
import { TOKENS_CSS } from '../src/ui/styles.ts';
import { showToast } from '../src/ui/toast.ts';

const PAGE_CSS = `
.b2t-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; padding: 0; margin: 0;
  color: var(--b2t-accent); background: oklch(0.17 0.008 70 / 0.85);
  border: 1px solid var(--b2t-accent-dim); border-radius: 4px;
  cursor: pointer; opacity: 0.8; transition: opacity 0.12s, border-color 0.12s;
}
.b2t-btn:hover, .b2t-btn:focus-visible { opacity: 1; border-color: var(--b2t-accent); outline: none; }
.b2t-btn[aria-busy='true'] { opacity: 0.45; cursor: progress; }
.b2t-btn--slot { position: absolute; top: 2px; right: 2px; z-index: 5; }
.b2t-btn--inline { width: 16px; height: 16px; margin-left: 4px; vertical-align: -3px; }
`;

async function openTrade(league: string, query: TradeQuery, anchor: HTMLElement): Promise<void> {
  const res = await sendMessage({ type: 'openTab', url: await tradeUrl(league, query) });
  if (!res.ok) showToast(anchor, t('loadError'));
}

function reportError(anchor: HTMLElement, error: ErrorCode | 'unreadable', retry: () => void): void {
  if (error === 'network') showToast(anchor, t('loadError'), retry);
  else if (error === 'format') showToast(anchor, t('formatChanged'));
  else showToast(anchor, t('readError'), retry);
}

async function onSearchClick(target: Target, btn: HTMLButtonElement): Promise<void> {
  if (btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  const retry = () => void onSearchClick(target, btn);
  try {
    const item: ItemResult = await getItem(target);
    if (!item.ok) return reportError(btn, item.error, retry);

    const [model, context, settings] = await Promise.all([
      sendMessage({ type: 'toModel', item: item.data }),
      sendMessage({ type: 'context' }),
      getSettings(),
    ]);
    if (!model.ok) return reportError(btn, model.error, retry);
    if (!context.ok) return reportError(btn, context.error, retry);

    const m = model.data;
    const league = context.data.league;
    if (m.rarity === 'unique' || m.rarity === 'normal') {
      await openTrade(league, buildDirectQuery(m, settings.status), btn);
      return;
    }
    openPopup({
      anchor: btn,
      model: m,
      settings,
      context: context.data,
      onSearch: (sel) => void openTrade(league, buildQuery(m, sel), btn),
    });
  } catch (err) {
    console.error('[b2t] search failed', err);
    showToast(btn, t('loadError'), retry);
  } finally {
    btn.removeAttribute('aria-busy');
  }
}

function inject(root: ParentNode): void {
  for (const target of findTargets(root)) {
    target.el.setAttribute(INJECTED_ATTR, '');
    const btn = h('button', {
      type: 'button',
      class: `b2t-root b2t-btn b2t-btn--${target.kind}`,
      title: t('searchOnTrade'),
      'aria-label': t('searchOnTrade'),
    });
    btn.innerHTML = SEARCH_ICON;
    // Keep maxroll's own slot/tooltip handlers from reacting to our button.
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup']) {
      btn.addEventListener(type, (e) => e.stopPropagation());
    }
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void onSearchClick(target, btn);
    });

    if (target.kind === 'slot') {
      if (getComputedStyle(target.el).position === 'static') target.el.style.position = 'relative';
      target.el.append(btn);
    } else {
      target.el.after(btn);
    }
  }
}

export default defineContentScript({
  matches: ['https://maxroll.gg/poe2/*'],
  runAt: 'document_idle',
  main(ctx) {
    const style = h('style', { id: 'b2t-page-style' });
    style.textContent = TOKENS_CSS + PAGE_CSS;
    document.head.append(style);

    inject(document);
    let pending = 0;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = window.setTimeout(() => {
        pending = 0;
        inject(document);
      }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    ctx.onInvalidated(() => {
      observer.disconnect();
      closePopup();
      style.remove();
      document.querySelectorAll('.b2t-btn').forEach((b) => b.remove());
      document.querySelectorAll(`[${INJECTED_ATTR}]`).forEach((el) => el.removeAttribute(INJECTED_ATTR));
    });
  },
});

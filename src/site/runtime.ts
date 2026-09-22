import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { exchangeUrl, tradeUrl } from '../core/encode.ts';
import { linkSearch } from '../core/links.ts';
import { buildDirectQuery, buildQuery } from '../core/query.ts';
import type { ItemModel, LinkTarget, TradeQuery } from '../core/types.ts';
import { t } from '../ext/i18n.ts';
import { sendMessage, type ErrorCode, type Response } from '../ext/messages.ts';
import { getSettings } from '../ext/settings.ts';
import { SEARCH_ICON, h } from '../ui/dom.ts';
import { createHoverButton } from '../ui/hover.ts';
import { closePopup, openPopup } from '../ui/popup.ts';
import { TOKENS_CSS } from '../ui/styles.ts';
import { showToast } from '../ui/toast.ts';

/** Set on elements that already have a search button. */
export const INJECTED_ATTR = 'data-b2t-injected';
/** Set on name elements checked against trade data; the value of LINK_ATTR is the name. */
export const LINK_CHECKED_ATTR = 'data-b2t-link-checked';
export const LINK_ATTR = 'data-b2t-link';

export type ModelResult = Response<ItemModel> | { ok: false; error: 'unreadable' };

export interface ItemTarget {
  el: HTMLElement;
  /** 'slot': button in the element's top-right corner; 'inline': button right after it. */
  placement: 'slot' | 'inline';
  model: () => Promise<ModelResult>;
}

export interface LinkCandidate {
  el: HTMLElement;
  name: string;
}

/** What differs per build site: where items and item names are on the page. */
export interface SiteAdapter {
  /** Equipment items without INJECTED_ATTR that should get a search button. */
  items(root: ParentNode): ItemTarget[];
  /** Elements without LINK_CHECKED_ATTR whose text may be a gem, currency, or item name. */
  links(root: ParentNode): LinkCandidate[];
}

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
.b2t-btn--hover { position: absolute; z-index: 2147483645; width: 18px; height: 18px; opacity: 1; }
.b2t-btn[hidden] { display: none; }
`;

async function openUrl(url: string, anchor: HTMLElement): Promise<void> {
  const res = await sendMessage({ type: 'openTab', url });
  if (!res.ok) showToast(anchor, t('loadError'));
}

async function openTrade(league: string, query: TradeQuery, anchor: HTMLElement): Promise<void> {
  await openUrl(await tradeUrl(league, query), anchor);
}

// ---- name links (gems, currency, uniques, bases) ----

/** Name → search target; null when trade cannot search it. Persists across scans. */
const linkTargets = new Map<string, LinkTarget | null>();

async function scanLinks(adapter: SiteAdapter, root: ParentNode): Promise<void> {
  const candidates = adapter.links(root);
  if (!candidates.length) return;
  const unknown = [...new Set(candidates.map((c) => c.name))].filter((n) => n && !linkTargets.has(n));
  if (unknown.length) {
    const res = await sendMessage({ type: 'resolveLinks', names: unknown });
    if (!res.ok) return; // leave candidates unchecked so the next scan retries
    for (const name of unknown) linkTargets.set(name, res.data[name] ?? null);
  }
  for (const { el, name } of candidates) {
    el.setAttribute(LINK_CHECKED_ATTR, '');
    if (linkTargets.get(name)) el.setAttribute(LINK_ATTR, name);
  }
}

async function onLinkClick(link: HTMLElement, button: HTMLButtonElement): Promise<void> {
  const target = linkTargets.get(link.getAttribute(LINK_ATTR) ?? '');
  if (!target) return;
  try {
    const [context, settings] = await Promise.all([sendMessage({ type: 'context' }), getSettings()]);
    if (!context.ok) return showToast(button, t('loadError'));
    const search = linkSearch(target, settings.status);
    const league = context.data.league;
    await openUrl(
      search.mode === 'exchange' ? await exchangeUrl(league, search.query) : await tradeUrl(league, search.query),
      button,
    );
  } catch (err) {
    console.error('[b2t] link search failed', err);
    showToast(button, t('loadError'));
  }
}

// ---- equipment items ----

function reportError(anchor: HTMLElement, error: ErrorCode | 'unreadable', retry: () => void): void {
  if (error === 'network') showToast(anchor, t('loadError'), retry);
  else if (error === 'format') showToast(anchor, t('formatChanged'));
  else showToast(anchor, t('readError'), retry);
}

async function onSearchClick(target: ItemTarget, btn: HTMLButtonElement): Promise<void> {
  if (btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  const retry = () => void onSearchClick(target, btn);
  try {
    const [model, context, settings] = await Promise.all([
      target.model(),
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

function inject(adapter: SiteAdapter, root: ParentNode): void {
  for (const target of adapter.items(root)) {
    target.el.setAttribute(INJECTED_ATTR, '');
    const btn = h('button', {
      type: 'button',
      class: `b2t-root b2t-btn b2t-btn--${target.placement}`,
      title: t('searchOnTrade'),
      'aria-label': t('searchOnTrade'),
    });
    btn.innerHTML = SEARCH_ICON;
    // Keep the site's own slot/tooltip handlers from reacting to our button.
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup']) {
      btn.addEventListener(type, (e) => e.stopPropagation());
    }
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void onSearchClick(target, btn);
    });

    if (target.placement === 'slot') {
      if (getComputedStyle(target.el).position === 'static') target.el.style.position = 'relative';
      target.el.append(btn);
    } else {
      target.el.after(btn);
    }
  }
}

/** Adds search buttons to a build site and keeps them in sync with client-side rendering. */
export function runSite(ctx: ContentScriptContext, adapter: SiteAdapter): void {
  const style = h('style', { id: 'b2t-page-style' });
  style.textContent = TOKENS_CSS + PAGE_CSS;
  document.head.append(style);

  const scan = () => {
    inject(adapter, document);
    void scanLinks(adapter, document);
  };
  const hover = createHoverButton({
    selector: `[${LINK_ATTR}]`,
    label: t('searchOnTrade'),
    onClick: (link, button) => void onLinkClick(link, button),
  });

  scan();
  let pending = 0;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      scan();
    }, 200);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  ctx.onInvalidated(() => {
    observer.disconnect();
    hover.destroy();
    closePopup();
    style.remove();
    document.querySelectorAll('.b2t-btn').forEach((b) => b.remove());
    document.querySelectorAll(`[${INJECTED_ATTR}]`).forEach((el) => el.removeAttribute(INJECTED_ATTR));
    document.querySelectorAll(`[${LINK_CHECKED_ATTR}]`).forEach((el) => {
      el.removeAttribute(LINK_CHECKED_ATTR);
      el.removeAttribute(LINK_ATTR);
    });
  });
}

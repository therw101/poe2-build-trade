import type { PlannerItem } from '../core/types.ts';
import { isPlannerItem } from '../core/validate.ts';
import { sendMessage, type Response } from '../ext/messages.ts';
import { ITEM_EVENT, KEY_ATTR, READ_EVENT, type ItemReply } from './bridge.ts';

export const INJECTED_ATTR = 'data-b2t-injected';

export type Target =
  | { kind: 'slot'; el: HTMLElement }
  | { kind: 'inline'; el: HTMLElement; profileId: string; itemId: string };

const RARITY_CLASS = /^poe2-item-(normal|magic|rare|unique)$/;

/** Equipment items on a maxroll PoE2 page that do not have a search button yet. */
export function findTargets(root: ParentNode): Target[] {
  const targets: Target[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(`.poe2-PaperdollSlot:not([${INJECTED_ATTR}])`)) {
    if ([...el.classList].some((c) => RARITY_CLASS.test(c))) targets.push({ kind: 'slot', el });
  }
  for (const el of root.querySelectorAll<HTMLElement>(
    `span.poe2-item[data-poe2-profile]:not([${INJECTED_ATTR}])`,
  )) {
    const itemId = el.dataset.poe2Id ?? '';
    const profileId = el.dataset.poe2Profile ?? '';
    if (/^\d+$/.test(itemId) && profileId) targets.push({ kind: 'inline', el, profileId, itemId });
  }
  return targets;
}

export const LINK_ATTR = 'data-b2t-link';
const LINK_CHECKED_ATTR = 'data-b2t-link-checked';

/**
 * Inline guide links (gems, currency, uniques, bases) not yet checked against trade data.
 * Planner items ("New Item" spans with a profile) are handled by findTargets instead.
 */
export function findLinkSpans(root: ParentNode): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      `span.poe2-item[data-poe2-text]:not([data-poe2-profile]):not([${LINK_CHECKED_ATTR}])`,
    ),
  ];
}

export function markLinkSpan(el: HTMLElement, searchable: boolean): void {
  el.setAttribute(LINK_CHECKED_ATTR, '');
  if (searchable) el.setAttribute(LINK_ATTR, '');
}

/** Asks the MAIN-world reader for the item currently rendered in a paperdoll slot. */
export function readSlotItem(el: HTMLElement, timeoutMs = 1500): Promise<PlannerItem | null> {
  const key = crypto.randomUUID();
  el.setAttribute(KEY_ATTR, key);
  return new Promise((resolve) => {
    const done = (item: PlannerItem | null) => {
      document.removeEventListener(ITEM_EVENT, onReply);
      clearTimeout(timer);
      resolve(item);
    };
    const onReply = (e: Event) => {
      let reply: ItemReply;
      try {
        reply = JSON.parse(String((e as CustomEvent<string>).detail));
      } catch {
        return;
      }
      if (reply.key === key) done(isPlannerItem(reply.item) ? reply.item : null);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    document.addEventListener(ITEM_EVENT, onReply);
    document.dispatchEvent(new CustomEvent(READ_EVENT, { detail: key }));
  });
}

export type ItemResult = Response<PlannerItem> | { ok: false; error: 'unreadable' };

export async function getItem(t: Target): Promise<ItemResult> {
  if (t.kind === 'slot') {
    const item = await readSlotItem(t.el);
    return item ? { ok: true, data: item } : { ok: false, error: 'unreadable' };
  }
  return sendMessage({ type: 'plannerItem', profileId: t.profileId, itemId: t.itemId });
}

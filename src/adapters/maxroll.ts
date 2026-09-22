import { isPlannerItem } from '../core/validate.ts';
import { sendMessage } from '../ext/messages.ts';
import { INJECTED_ATTR, LINK_CHECKED_ATTR, type ItemTarget, type SiteAdapter } from '../site/runtime.ts';
import { readPageItem } from './reader.ts';

const RARITY_CLASS = /^poe2-item-(normal|magic|rare|unique)$/;

export const maxrollAdapter: SiteAdapter = {
  items(root) {
    const targets: ItemTarget[] = [];
    // Paperdoll slots: the item lives in React props, read by the MAIN-world reader.
    for (const el of root.querySelectorAll<HTMLElement>(`.poe2-PaperdollSlot:not([${INJECTED_ATTR}])`)) {
      if (![...el.classList].some((c) => RARITY_CLASS.test(c))) continue;
      targets.push({
        el,
        placement: 'slot',
        model: async () => {
          const item = await readPageItem(el);
          return isPlannerItem(item) ? sendMessage({ type: 'toModel', item }) : { ok: false, error: 'unreadable' };
        },
      });
    }
    // "New Item" links in the guide text: the item comes from the planner API.
    for (const el of root.querySelectorAll<HTMLElement>(`span.poe2-item[data-poe2-profile]:not([${INJECTED_ATTR}])`)) {
      const itemId = el.dataset.poe2Id ?? '';
      const profileId = el.dataset.poe2Profile ?? '';
      if (!/^\d+$/.test(itemId) || !profileId) continue;
      targets.push({
        el,
        placement: 'inline',
        model: async () => {
          const item = await sendMessage({ type: 'plannerItem', profileId, itemId });
          return item.ok ? sendMessage({ type: 'toModel', item: item.data }) : item;
        },
      });
    }
    return targets;
  },

  // Gem, currency, unique, and base links in the guide text carry their name in data-poe2-text.
  links(root) {
    return [
      ...root.querySelectorAll<HTMLElement>(
        `span.poe2-item[data-poe2-text]:not([data-poe2-profile]):not([${LINK_CHECKED_ATTR}])`,
      ),
    ].map((el) => ({ el, name: el.dataset.poe2Text ?? '' }));
  },
};

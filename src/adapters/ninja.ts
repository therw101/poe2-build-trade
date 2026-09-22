import { sendMessage } from '../ext/messages.ts';
import { INJECTED_ATTR, LINK_CHECKED_ATTR, type ItemTarget, type SiteAdapter } from '../site/runtime.ts';
import { leafNames } from './names.ts';
import { readPageItem } from './reader.ts';

/** Equipment tiles, including flasks and charms, inside the paperdoll grid. */
const ITEM_TILE = '[class*="_equipment_"] [data-tooltip-trigger]';

/**
 * poe.ninja pages. Skill gems get the hover search everywhere. Equipment gets a button
 * only on PoB pages (/poe2/pob/…): character pages already have poe.ninja's own trade search.
 */
export const ninjaAdapter: SiteAdapter = {
  items(root) {
    if (!location.pathname.startsWith('/poe2/pob/')) return [];
    return [...root.querySelectorAll<HTMLElement>(`${ITEM_TILE}:not([${INJECTED_ATTR}])`)].map(
      (el): ItemTarget => ({
        el,
        placement: 'slot',
        model: async () => {
          const item = await readPageItem(el);
          return item ? sendMessage({ type: 'ninjaModel', item }) : { ok: false, error: 'unreadable' };
        },
      }),
    );
  },
  links: (root) => leafNames(root, '[data-tooltip-trigger]', LINK_CHECKED_ATTR),
};

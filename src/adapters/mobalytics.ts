import { sendMessage } from '../ext/messages.ts';
import { INJECTED_ATTR, LINK_CHECKED_ATTR, type ItemTarget, type SiteAdapter } from '../site/runtime.ts';
import { leafNames } from './names.ts';
import { readPageItem } from './reader.ts';

/** Every paperdoll slot renders a hidden link to mobalytics' own trade search. */
const SLOT_TRADE_LINK = 'a[href^="https://www.pathofexile.com/trade2/search/"]';

export const mobalyticsAdapter: SiteAdapter = {
  items(root) {
    const targets: ItemTarget[] = [];
    for (const link of root.querySelectorAll(SLOT_TRADE_LINK)) {
      // Slot box > link wrapper > <a>; the slot box also holds the icon and priority badge.
      const el = link.parentElement?.parentElement;
      if (!el || el.hasAttribute(INJECTED_ATTR) || targets.some((t) => t.el === el)) continue;
      targets.push({
        el,
        placement: 'slot',
        model: async () => {
          const slot = await readPageItem(el);
          return slot ? sendMessage({ type: 'mobaModel', slot }) : { ok: false, error: 'unreadable' };
        },
      });
    }
    return targets;
  },

  // Gem cards and guide-text item widgets are tooltip triggers with the name as text.
  links: (root) => leafNames(root, '[data-tippy-delegate-id]', LINK_CHECKED_ATTR),
};

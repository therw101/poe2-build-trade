import { LINK_CHECKED_ATTR, type SiteAdapter } from '../site/runtime.ts';
import { leafNames } from './names.ts';

/**
 * poe.ninja character pages. Equipment already has poe.ninja's own trade search, so only
 * skill gems (and any other names in tooltip rows) get a hover search.
 */
export const ninjaAdapter: SiteAdapter = {
  items: () => [],
  links: (root) => leafNames(root, '[data-tooltip-trigger]', LINK_CHECKED_ATTR),
};

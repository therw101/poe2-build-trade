import { ITEM_EVENT, KEY_ATTR, READ_EVENT, type ItemReply } from '../src/adapters/bridge.ts';
import { findItemInFiber, findMobaSlotInFiber, findNinjaItemInFiber } from '../src/adapters/fiber.ts';

// Runs in the page's MAIN world so it can see React's fiber on paperdoll slots.
export default defineContentScript({
  matches: ['https://maxroll.gg/poe2/*', 'https://mobalytics.gg/poe-2/*', 'https://poe.ninja/poe2/pob/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    const find =
      location.hostname === 'mobalytics.gg'
        ? findMobaSlotInFiber
        : location.hostname === 'poe.ninja'
          ? findNinjaItemInFiber
          : findItemInFiber;
    document.addEventListener(READ_EVENT, (e) => {
      const key = (e as CustomEvent<string>).detail;
      if (typeof key !== 'string') return;
      const el = document.querySelector(`[${KEY_ATTR}="${CSS.escape(key)}"]`);
      const reply: ItemReply = { key, item: el ? find(el) : null };
      document.dispatchEvent(new CustomEvent(ITEM_EVENT, { detail: JSON.stringify(reply) }));
    });
  },
});

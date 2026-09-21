import { ITEM_EVENT, KEY_ATTR, READ_EVENT, type ItemReply } from '../src/adapters/bridge.ts';
import { findItemInFiber } from '../src/adapters/fiber.ts';

// Runs in the page's MAIN world so it can see React's fiber on paperdoll slots.
export default defineContentScript({
  matches: ['https://maxroll.gg/poe2/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    document.addEventListener(READ_EVENT, (e) => {
      const key = (e as CustomEvent<string>).detail;
      if (typeof key !== 'string') return;
      const el = document.querySelector(`[${KEY_ATTR}="${CSS.escape(key)}"]`);
      const reply: ItemReply = { key, item: el ? findItemInFiber(el) : null };
      document.dispatchEvent(new CustomEvent(ITEM_EVENT, { detail: JSON.stringify(reply) }));
    });
  },
});

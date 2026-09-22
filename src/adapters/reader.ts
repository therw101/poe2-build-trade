import { ITEM_EVENT, KEY_ATTR, READ_EVENT, type ItemReply } from './bridge.ts';

/**
 * Asks the MAIN-world reader for the item React rendered into `el`. The isolated
 * content script cannot see React's fiber, so the reply crosses worlds as JSON.
 */
export function readPageItem(el: HTMLElement, timeoutMs = 1500): Promise<unknown> {
  const key = crypto.randomUUID();
  el.setAttribute(KEY_ATTR, key);
  return new Promise((resolve) => {
    const done = (item: unknown) => {
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
      if (reply.key === key) done(reply.item);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    document.addEventListener(ITEM_EVENT, onReply);
    document.dispatchEvent(new CustomEvent(READ_EVENT, { detail: key }));
  });
}

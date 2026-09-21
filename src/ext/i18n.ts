import { browser } from 'wxt/browser';

/** Localized UI string; falls back to the key so a missing message is visible, not blank. */
export function t(key: string, ...subs: (string | number)[]): string {
  return browser.i18n.getMessage(key as never, subs.map(String)) || key;
}

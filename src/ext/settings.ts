import { browser } from 'wxt/browser';
import type { TradeStatus } from '../core/types.ts';

export interface Settings {
  /** Trade league id; null means "use the current default league". */
  league: string | null;
  /** Default minimum as a fraction of the build value (0.5–1). */
  minPct: number;
  status: TradeStatus;
}

export const DEFAULT_SETTINGS: Settings = { league: null, minPct: 0.8, status: 'available' };

export async function getSettings(): Promise<Settings> {
  const { settings } = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await browser.storage.local.set({ settings: { ...(await getSettings()), ...patch } });
}

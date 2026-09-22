import { browser, type Browser } from 'wxt/browser';
import {
  MAXROLL_PLANNER_URL,
  REFRESH_INTERVAL_MS,
  TRADE_EXCHANGE_URL,
  TRADE_LEAGUES_URL,
  TRADE_SEARCH_URL,
  dataBaseUrl,
  releasesApiUrl,
} from '../src/config.ts';
import { compareVersions, pickDefaultLeague, type League } from '../src/core/leagues.ts';
import { lookupName } from '../src/core/links.ts';
import { mobaToModel } from '../src/core/mobalytics.ts';
import { basesByName, ninjaToModel, type BasesByName } from '../src/core/ninja.ts';
import { indexStatMap, type StatIndex } from '../src/core/statmap.ts';
import { indexStatTexts, type TextIndex } from '../src/core/textmods.ts';
import { toItemModel } from '../src/core/translate.ts';
import type { BaseMap, LinkTarget, PlannerItem, StatMap, TradeItemsMap, TradeStatText } from '../src/core/types.ts';
import { isMobaSlot, isNinjaItem, isPlannerItem, isStatMap, isTradeItemsMap, isTradeStatText } from '../src/core/validate.ts';
import type { Context, Request, Response } from '../src/ext/messages.ts';
import { getSettings, saveSettings } from '../src/ext/settings.ts';

interface Maps {
  statMap: StatMap;
  baseMap: BaseMap;
}
interface Cached<T> {
  value: T;
  fetchedAt: number;
}

const fresh = (c: Cached<unknown> | undefined) => !!c && Date.now() - c.fetchedAt < REFRESH_INTERVAL_MS;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

// ---- data maps: bundled snapshot, replaced by a newer remote copy when available ----

let loaded: { maps: Maps; index: StatIndex } | null = null;
/** Text matcher and base-by-name lookup for poe.ninja items, built from `loaded` on first use. */
let ninjaData: { from: Maps; texts: TextIndex; bases: BasesByName } | null = null;

async function getNinjaData(): Promise<{ texts: TextIndex; bases: BasesByName; index: StatIndex }> {
  const { maps, index } = await getMaps();
  if (ninjaData?.from !== maps) {
    ninjaData = { from: maps, texts: indexStatTexts(maps.statMap), bases: basesByName(maps.baseMap) };
  }
  return { texts: ninjaData.texts, bases: ninjaData.bases, index };
}

async function bundledMaps(): Promise<Maps> {
  const [statMap, baseMap] = await Promise.all([
    fetchJson<StatMap>(browser.runtime.getURL('/data/stat-map.json')),
    fetchJson<BaseMap>(browser.runtime.getURL('/data/base-map.json')),
  ]);
  return { statMap, baseMap };
}

async function refreshRemoteMaps(): Promise<void> {
  const base = dataBaseUrl();
  if (!base) return;
  const { remoteMaps } = (await browser.storage.local.get('remoteMaps')) as { remoteMaps?: Cached<Maps> };
  if (fresh(remoteMaps)) return;
  try {
    const [statMap, baseMap] = await Promise.all([
      fetchJson<unknown>(`${base}/stat-map.json`),
      fetchJson<BaseMap>(`${base}/base-map.json`),
    ]);
    if (!isStatMap(statMap)) throw new Error('remote stat map has an unexpected shape');
    await browser.storage.local.set({ remoteMaps: { value: { statMap, baseMap }, fetchedAt: Date.now() } });
    loaded = null;
  } catch (err) {
    console.warn('[b2t] data refresh failed, keeping current data', err);
  }
}

async function getMaps(): Promise<{ maps: Maps; index: StatIndex }> {
  void refreshRemoteMaps();
  if (loaded) return loaded;
  const bundled = await bundledMaps();
  const { remoteMaps } = (await browser.storage.local.get('remoteMaps')) as { remoteMaps?: Cached<Maps> };
  const maps =
    remoteMaps && remoteMaps.value.statMap.generatedAt > bundled.statMap.generatedAt ? remoteMaps.value : bundled;
  loaded = { maps, index: indexStatMap(maps.statMap) };
  return loaded;
}

// ---- single-file data (link names, stat text): same bundled/remote model as the maps ----

function dataFile<T extends { generatedAt: string }>(
  file: 'trade-items.json' | 'trade-stat-text.json',
  storageKey: string,
  valid: (x: unknown) => x is T,
): () => Promise<T> {
  let loadedFile: T | null = null;

  async function refresh(): Promise<void> {
    const base = dataBaseUrl();
    if (!base) return;
    const cached = ((await browser.storage.local.get(storageKey)) as Record<string, Cached<T> | undefined>)[storageKey];
    if (fresh(cached)) return;
    try {
      const value = await fetchJson<unknown>(`${base}/${file}`);
      if (!valid(value)) throw new Error(`remote ${file} has an unexpected shape`);
      await browser.storage.local.set({ [storageKey]: { value, fetchedAt: Date.now() } });
      loadedFile = null;
    } catch (err) {
      console.warn(`[b2t] ${file} refresh failed, keeping current data`, err);
    }
  }

  return async () => {
    void refresh();
    if (loadedFile) return loadedFile;
    const bundled = await fetchJson<T>(browser.runtime.getURL(`/data/${file}`));
    const remote = ((await browser.storage.local.get(storageKey)) as Record<string, Cached<T> | undefined>)[storageKey];
    loadedFile = remote && remote.value.generatedAt > bundled.generatedAt ? remote.value : bundled;
    return loadedFile;
  };
}

const getTradeItems = dataFile<TradeItemsMap>('trade-items.json', 'remoteTradeItems', isTradeItemsMap);
const getStatText = dataFile<TradeStatText>('trade-stat-text.json', 'remoteStatText', isTradeStatText);

async function resolveLinks(names: string[]): Promise<Response<Record<string, LinkTarget>>> {
  const { byName } = await getTradeItems();
  const out: Record<string, LinkTarget> = {};
  for (const name of names) {
    const t = typeof name === 'string' ? lookupName(byName, name) : undefined;
    if (t) out[name] = t;
  }
  return { ok: true, data: out };
}

// ---- maxroll planner ----

async function plannerItem(profileId: string, itemId: string): Promise<Response<PlannerItem>> {
  const key = `planner:${profileId}`;
  let items = ((await browser.storage.session.get(key)) as Record<string, Record<string, unknown>>)[key];
  if (!items) {
    let profile: { data?: unknown };
    try {
      profile = await fetchJson(`${MAXROLL_PLANNER_URL}${encodeURIComponent(profileId)}`);
    } catch (err) {
      console.error('[b2t] planner fetch failed', err);
      return { ok: false, error: 'network' };
    }
    try {
      items = JSON.parse(String(profile.data)).items;
    } catch {
      return { ok: false, error: 'format' };
    }
    if (typeof items !== 'object' || items === null) return { ok: false, error: 'format' };
    await browser.storage.session.set({ [key]: items });
  }
  const item = items[itemId];
  if (item === undefined) return { ok: false, error: 'notFound' };
  return isPlannerItem(item) ? { ok: true, data: item } : { ok: false, error: 'format' };
}

// ---- leagues, release check, context ----

async function getLeagues(): Promise<League[] | null> {
  const { leagues } = (await browser.storage.local.get('leagues')) as { leagues?: Cached<League[]> };
  if (fresh(leagues)) return leagues!.value;
  try {
    const { result } = await fetchJson<{ result: League[] }>(TRADE_LEAGUES_URL);
    await browser.storage.local.set({ leagues: { value: result, fetchedAt: Date.now() } });
    return result;
  } catch (err) {
    console.warn('[b2t] leagues fetch failed', err);
    return leagues?.value ?? null;
  }
}

async function getUpdate(): Promise<Context['update']> {
  const url = releasesApiUrl();
  if (!url) return null;
  const { release } = (await browser.storage.local.get('release')) as {
    release?: Cached<{ version: string; url: string } | null>;
  };
  let latest = release?.value ?? null;
  if (!fresh(release)) {
    try {
      const r = await fetchJson<{ tag_name: string; html_url: string }>(url);
      latest = { version: r.tag_name.replace(/^v/, ''), url: r.html_url };
      await browser.storage.local.set({ release: { value: latest, fetchedAt: Date.now() } });
    } catch (err) {
      console.warn('[b2t] release check failed', err);
    }
  }
  const current = browser.runtime.getManifest().version;
  return latest && compareVersions(latest.version, current) > 0 ? latest : null;
}

async function context(): Promise<Context> {
  const settings = await getSettings();
  const leagues = await getLeagues();
  let league = settings.league;
  let leagueChanged = false;
  if (leagues) {
    if (!league) {
      league = pickDefaultLeague(leagues);
    } else if (!leagues.some((l) => l.id === league)) {
      league = pickDefaultLeague(leagues);
      leagueChanged = true;
      await saveSettings({ league });
    }
  }
  const [update, { maps }] = await Promise.all([getUpdate(), getMaps()]);
  return { league: league ?? 'Standard', leagueChanged, update, dataGeneratedAt: maps.statMap.generatedAt };
}

/** Opens trade in a tab next to the build page; avoids popup blockers after async work. */
async function openTab(url: string, sender: Browser.runtime.MessageSender): Promise<Response<null>> {
  if (!url.startsWith(TRADE_SEARCH_URL) && !url.startsWith(TRADE_EXCHANGE_URL)) return { ok: false, error: 'format' };
  const tab = sender.tab;
  await browser.tabs.create({
    url,
    ...(tab?.index !== undefined ? { index: tab.index + 1 } : {}),
    ...(tab?.id !== undefined ? { openerTabId: tab.id } : {}),
  });
  return { ok: true, data: null };
}

async function handle(req: Request, sender: Browser.runtime.MessageSender): Promise<Response<unknown>> {
  switch (req.type) {
    case 'plannerItem':
      return plannerItem(req.profileId, req.itemId);
    case 'toModel': {
      if (!isPlannerItem(req.item)) return { ok: false, error: 'format' };
      const { maps, index } = await getMaps();
      return { ok: true, data: toItemModel(req.item, index, maps.baseMap) };
    }
    case 'mobaModel': {
      if (!isMobaSlot(req.slot)) return { ok: false, error: 'format' };
      const [statText, tradeItems] = await Promise.all([getStatText(), getTradeItems()]);
      return { ok: true, data: mobaToModel(req.slot, statText, tradeItems) };
    }
    case 'ninjaModel': {
      if (!isNinjaItem(req.item)) return { ok: false, error: 'format' };
      const { texts, bases, index } = await getNinjaData();
      return { ok: true, data: ninjaToModel(req.item, texts, index, bases) };
    }
    case 'context':
      return { ok: true, data: await context() };
    case 'openTab':
      return openTab(req.url, sender);
    case 'resolveLinks':
      return Array.isArray(req.names) ? resolveLinks(req.names) : { ok: false, error: 'format' };
    default:
      return { ok: false, error: 'format' };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((req: Request, sender, sendResponse) => {
    handle(req, sender).then(sendResponse, (err: unknown) => {
      console.error('[b2t] request failed', req.type, err);
      sendResponse({ ok: false, error: 'network' });
    });
    return true;
  });
});

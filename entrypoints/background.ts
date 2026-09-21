import { browser } from 'wxt/browser';
import {
  MAXROLL_PLANNER_URL,
  REFRESH_INTERVAL_MS,
  TRADE_LEAGUES_URL,
  dataBaseUrl,
  releasesApiUrl,
} from '../src/config.ts';
import { compareVersions, pickDefaultLeague, type League } from '../src/core/leagues.ts';
import { indexStatMap, type StatIndex } from '../src/core/statmap.ts';
import { toItemModel } from '../src/core/translate.ts';
import type { BaseMap, PlannerItem, StatMap } from '../src/core/types.ts';
import { isPlannerItem, isStatMap } from '../src/core/validate.ts';
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

async function handle(req: Request): Promise<Response<unknown>> {
  switch (req.type) {
    case 'plannerItem':
      return plannerItem(req.profileId, req.itemId);
    case 'toModel': {
      if (!isPlannerItem(req.item)) return { ok: false, error: 'format' };
      const { maps, index } = await getMaps();
      return { ok: true, data: toItemModel(req.item, index, maps.baseMap) };
    }
    case 'context':
      return { ok: true, data: await context() };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((req: Request, _sender, sendResponse) => {
    handle(req).then(sendResponse, (err: unknown) => {
      console.error('[b2t] request failed', req.type, err);
      sendResponse({ ok: false, error: 'network' });
    });
    return true;
  });
});

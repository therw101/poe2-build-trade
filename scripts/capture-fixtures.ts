// Captures real API responses into tests/fixtures. Run manually when fixtures need refreshing:
//   node --experimental-strip-types scripts/capture-fixtures.ts
import { writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'poe2-build-trade-fixtures/0.1 (+github)' };
const PROFILE = 'z7coxn0y';
const out = (name: string, data: unknown) =>
  writeFileSync(`tests/fixtures/${name}`, JSON.stringify(data, null, 1));

async function get(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

const planner = await get(`https://planners.maxroll.gg/profiles/poe2/${PROFILE}`);
out(`planner-${PROFILE}.json`, planner);
out('trade-stats.json', await get('https://www.pathofexile.com/api/trade2/data/stats'));
out('trade-leagues.json', await get('https://www.pathofexile.com/api/trade2/data/leagues'));

const items: Record<string, any> = JSON.parse(planner.data).items;
const usedStats = new Set<string>();
const usedBases = new Set<string>();
for (const item of Object.values(items)) {
  usedBases.add(item.base);
  for (const group of Object.values(item.stats ?? {}) as Record<string, number>[]) {
    for (const id of Object.keys(group)) usedStats.add(id);
  }
}

const translations: any[] = await get(
  'https://repoe-fork.github.io/poe2/stat_translations/stat_descriptions.min.json',
);
out(
  'stat-descriptions.subset.json',
  translations.filter((t) => t.ids.some((id: string) => usedStats.has(id))),
);

const handlers: Record<string, any> = await get('https://repoe-fork.github.io/poe2/stat_value_handlers.min.json');
out(
  'stat-value-handlers.json',
  Object.fromEntries(Object.entries(handlers).filter(([, h]) => h.type === 'int')),
);

const bases: Record<string, any> = await get('https://repoe-fork.github.io/poe2/base_items.min.json');
out(
  'base-items.subset.json',
  Object.fromEntries(Object.entries(bases).filter(([k]) => usedBases.has(k))),
);
console.log(`captured: ${Object.keys(items).length} items, ${usedStats.size} stats, ${usedBases.size} bases`);

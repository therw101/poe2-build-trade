// Builds public/data/{stat-map,base-map,trade-items,trade-stat-text}.json from RePoE and the trade2 data API.
//   npm run build-data                 write to ./public/data
//   npm run build-data -- --out dir    write to another directory
//   npm run build-data -- --check      exit 1 when fixture coverage < 95%
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildBaseMap,
  buildStatMap,
  buildTradeItems,
  buildTradeStatText,
  coverage,
  type RepoeBase,
  type RepoeTranslation,
  type TradeItemsResponse,
  type TradeStaticResponse,
  type TradeStatsResponse,
  type ValueHandlers,
} from './lib/build-data-lib.ts';
import type { PlannerItem } from '../src/core/types.ts';

const REPOE = 'https://repoe-fork.github.io/poe2';
const MIN_COVERAGE = 0.95;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
const headers = { 'User-Agent': `poe2-build-trade/${version} (+github)` };

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] ?? 'public/data' : 'public/data';
const check = args.includes('--check');

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`[b2t] ${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

const TRADE_DATA = 'https://www.pathofexile.com/api/trade2/data';
const [translations, handlers, bases, tradeStats, tradeItemList, tradeStatic] = await Promise.all([
  get<RepoeTranslation[]>(`${REPOE}/stat_translations/stat_descriptions.min.json`),
  get<ValueHandlers>(`${REPOE}/stat_value_handlers.min.json`),
  get<Record<string, RepoeBase>>(`${REPOE}/base_items.min.json`),
  get<TradeStatsResponse>(`${TRADE_DATA}/stats`),
  get<TradeItemsResponse>(`${TRADE_DATA}/items`),
  get<TradeStaticResponse>(`${TRADE_DATA}/static`),
]);

const generatedAt = new Date().toISOString();
const statMap = buildStatMap(translations, tradeStats, handlers, generatedAt);
const baseMap = buildBaseMap(bases);
const tradeItems = buildTradeItems(tradeItemList, tradeStatic, generatedAt);
const tradeStatText = buildTradeStatText(tradeStats, generatedAt);

const planner = JSON.parse(readFileSync('tests/fixtures/planner-z7coxn0y.json', 'utf8'));
const items: PlannerItem[] = Object.values(JSON.parse(planner.data).items);
const cov = coverage(items, statMap);
console.log(
  `[b2t] stat entries: ${statMap.entries.length}, bases: ${Object.keys(baseMap).length}, ` +
    `link names: ${Object.keys(tradeItems.byName).length}, ` +
    `fixture coverage: ${cov.mapped}/${cov.total} (${(cov.ratio * 100).toFixed(1)}%)`,
);
if (cov.misses.length) console.log(`[b2t] unmapped: ${cov.misses.join(', ')}`);

if (check && cov.ratio < MIN_COVERAGE) {
  console.error(`[b2t] coverage below ${MIN_COVERAGE * 100}% — not writing data`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'stat-map.json'), JSON.stringify(statMap));
writeFileSync(join(outDir, 'base-map.json'), JSON.stringify(baseMap));
writeFileSync(join(outDir, 'trade-items.json'), JSON.stringify(tradeItems));
writeFileSync(join(outDir, 'trade-stat-text.json'), JSON.stringify(tradeStatText));
console.log(`[b2t] wrote stat-map, base-map, trade-items and trade-stat-text JSON to ${outDir}`);

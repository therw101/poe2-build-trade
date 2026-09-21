// Builds data/stat-map.json and data/base-map.json from RePoE and the trade2 data API.
//   npm run build-data                 write to ./data
//   npm run build-data -- --out dir    write to another directory
//   npm run build-data -- --check      exit 1 when fixture coverage < 95%
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildBaseMap,
  buildStatMap,
  coverage,
  type RepoeBase,
  type RepoeTranslation,
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
const outDir = outIdx >= 0 ? args[outIdx + 1] ?? 'data' : 'data';
const check = args.includes('--check');

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`[b2t] ${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

const [translations, handlers, bases, tradeStats] = await Promise.all([
  get<RepoeTranslation[]>(`${REPOE}/stat_translations/stat_descriptions.min.json`),
  get<ValueHandlers>(`${REPOE}/stat_value_handlers.min.json`),
  get<Record<string, RepoeBase>>(`${REPOE}/base_items.min.json`),
  get<TradeStatsResponse>('https://www.pathofexile.com/api/trade2/data/stats'),
]);

const statMap = buildStatMap(translations, tradeStats, handlers, new Date().toISOString());
const baseMap = buildBaseMap(bases);

const planner = JSON.parse(readFileSync('tests/fixtures/planner-z7coxn0y.json', 'utf8'));
const items: PlannerItem[] = Object.values(JSON.parse(planner.data).items);
const cov = coverage(items, statMap);
console.log(
  `[b2t] stat entries: ${statMap.entries.length}, bases: ${Object.keys(baseMap).length}, ` +
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
console.log(`[b2t] wrote ${outDir}/stat-map.json and ${outDir}/base-map.json`);

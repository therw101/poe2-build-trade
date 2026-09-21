// Debug helper: print translated ItemModels for fixture items.
//   node --experimental-strip-types scripts/dump-model.ts 32 309
import { readFileSync } from 'node:fs';
import { indexStatMap } from '../src/core/statmap.ts';
import { toItemModel } from '../src/core/translate.ts';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const items = JSON.parse(read('tests/fixtures/planner-z7coxn0y.json').data).items;
const stats = indexStatMap(read('data/stat-map.json'));
const bases = read('data/base-map.json');
for (const id of process.argv.slice(2)) {
  const m = toItemModel(items[id], stats, bases);
  console.log(`${id} ${m.rarity} ${m.name} | ${m.baseName} (${m.category}) sockets=${m.sockets}`);
  for (const r of m.mods) console.log(`   ${r.kind.padEnd(8)} ${String(r.tradeId).padEnd(26)} ${String(r.value).padStart(6)} | ${r.text}`);
}

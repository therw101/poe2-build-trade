import { categoryFor } from './categories.ts';
import type { StatIndex } from './statmap.ts';
import { STAT_KINDS, type BaseMap, type ItemModel, type ModRow, type PlannerItem, type StatKind, type StatMapEntry } from './types.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

function fill(template: string, values: number[]): string {
  let i = 0;
  return template.replace(/\+?#/g, (token) => {
    const v = values[i++];
    if (v === undefined) return token;
    return token.startsWith('+') && v >= 0 ? `+${round2(v)}` : String(round2(v));
  });
}

function optionRow(kind: StatKind, entry: StatMapEntry, value: number, stats: StatIndex): ModRow {
  const name = stats.options[entry.option!]?.[String(value)];
  const base = entry.trade[kind];
  return {
    kind,
    text: entry.text.replace(/\+?#/, name ?? String(value)),
    value,
    numeric: false,
    tradeId: name && base ? `${base}|${value}` : null,
  };
}

function rowForEntry(kind: StatKind, entry: StatMapEntry, group: Record<string, number>): ModRow {
  const shown: number[] = [];
  entry.ids.forEach((id, i) => {
    const raw = group[id];
    if (raw === undefined || entry.hidden?.includes(i)) return;
    const t = entry.transform?.[i];
    shown.push(t ? raw * t.f + t.a : raw);
  });
  const value = round2(shown.reduce((a, b) => a + b, 0) / Math.max(shown.length, 1));
  const useNeg = value < 0 && entry.negText !== undefined;
  const template = useNeg ? entry.negText! : entry.text;
  const text = useNeg
    ? fill(template, shown.map(Math.abs))
    : fill(value < 0 ? template.replace(/\+#/g, '#') : template, shown);
  return { kind, text, value, numeric: template.includes('#'), tradeId: entry.trade[kind] ?? null };
}

export function toItemModel(item: PlannerItem, stats: StatIndex, bases: BaseMap): ItemModel {
  const base = bases[item.base] ?? null;
  const itemClass = base?.itemClass ?? null;
  const mods: ModRow[] = [];

  for (const kind of STAT_KINDS) {
    const group = item.stats[kind] ?? {};
    const done = new Set<StatMapEntry>();
    for (const [id, value] of Object.entries(group)) {
      const entry = stats.byId.get(id);
      if (!entry) {
        mods.push({ kind, text: id.replace(/_/g, ' '), value, numeric: true, tradeId: null });
        continue;
      }
      if (done.has(entry)) continue;
      done.add(entry);
      mods.push(entry.option ? optionRow(kind, entry, value, stats) : rowForEntry(kind, entry, group));
    }
  }

  return {
    rarity: item.rarity,
    name: item.name ?? '',
    baseName: base?.name ?? null,
    itemClass,
    category: categoryFor(itemClass),
    sockets: item.sockets?.length ?? 0,
    mods,
  };
}

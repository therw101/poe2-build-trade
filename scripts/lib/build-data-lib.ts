import { CATEGORY_BY_CLASS } from '../../src/core/categories.ts';
import type { BaseMap, PlannerItem, StatKind, StatMap, StatMapEntry } from '../../src/core/types.ts';

const KINDS: readonly StatKind[] = ['explicit', 'implicit', 'enchant', 'crafted', 'fractured', 'rune'];

export interface RepoeVariant {
  condition: { min?: number; max?: number; negated?: boolean }[];
  format: string[];
  index_handlers: string[][];
  string: string;
}

export interface RepoeTranslation {
  ids: string[];
  English: RepoeVariant[];
  trade_stats?: { id: string; text: string; type: string }[];
}

export interface TradeStatsResponse {
  result: { id: string; entries: { id: string; text: string; type: string }[] }[];
}

export type ValueHandlers = Record<
  string,
  { type: string; divisor?: number; multiplier?: number; addend?: number }
>;

export interface RepoeBase {
  name: string;
  item_class: string;
  release_state?: string;
}

function isKind(s: string): s is StatKind {
  return (KINDS as readonly string[]).includes(s);
}

/** "[Spirit|Spirit]" → "Spirit", "[Spell]" → "Spell", "{0}" → "#". */
export function normalizeTemplate(s: string): string {
  return s
    .replace(/\[([^\]|]*\|)?([^\]]*)\]/g, '$2')
    .replace(/\{\d+\}/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

const isNegating = (v: RepoeVariant) => v.index_handlers.some((hs) => hs.some((h) => h.includes('negate')));

/** Template with each "{i}" replaced by its format ("#" or "+#"), markup stripped. */
function displayTemplate(v: RepoeVariant): string {
  const filled = v.string.replace(/\{(\d+)\}/g, (_, i: string) => {
    const f = v.format[Number(i)];
    return f && f !== 'ignore' ? `{${f}}` : '';
  });
  return normalizeTemplate(filled).replace(/\{(\+?#)\}/g, '$1');
}

function transformFor(v: RepoeVariant, handlers: ValueHandlers): { f: number; a: number }[] | undefined {
  const t = v.index_handlers.map((hs) => {
    let f = 1;
    let a = 0;
    for (const name of hs) {
      const h = handlers[name];
      if (!h || name.includes('negate')) continue;
      f = (f * (h.multiplier ?? 1)) / (h.divisor ?? 1);
      a = a * ((h.multiplier ?? 1) / (h.divisor ?? 1)) + (h.addend ?? 0);
    }
    return { f, a };
  });
  return t.some((x) => x.f !== 1 || x.a !== 0) ? t : undefined;
}

function tradeTextIndex(tradeStats: TradeStatsResponse): Map<string, string> {
  const index = new Map<string, string>();
  for (const group of tradeStats.result) {
    for (const e of group.entries) {
      const kind = e.id.split('.')[0] ?? '';
      if (!isKind(kind)) continue;
      const key = `${kind}|${e.text.toLowerCase()}`;
      if (!index.has(key)) index.set(key, e.id);
    }
  }
  return index;
}

function textCandidates(t: RepoeTranslation): string[] {
  const local = t.ids.some((id) => id.startsWith('local_'));
  const out: string[] = [];
  for (const v of t.English) {
    const s = normalizeTemplate(v.string);
    const variants = [s, s.replace(/^\+/, ''), s.startsWith('+') ? s : `+${s}`];
    for (const x of variants) {
      if (local) out.push(`${x} (Local)`);
      out.push(x);
    }
  }
  return [...new Set(out)];
}

export function buildStatMap(
  translations: RepoeTranslation[],
  tradeStats: TradeStatsResponse,
  handlers: ValueHandlers,
  generatedAt: string,
): StatMap {
  const byText = tradeTextIndex(tradeStats);
  const entries: StatMapEntry[] = [];

  for (const t of translations) {
    if (!t.English.length) continue;
    const trade: Partial<Record<StatKind, string>> = {};
    for (const ts of t.trade_stats ?? []) {
      const kind = ts.id.split('.')[0] ?? '';
      if (isKind(kind) && !trade[kind]) trade[kind] = ts.id;
    }
    const candidates = textCandidates(t);
    for (const kind of KINDS) {
      if (trade[kind]) continue;
      for (const c of candidates) {
        const id = byText.get(`${kind}|${c.toLowerCase()}`);
        if (id) {
          trade[kind] = id;
          break;
        }
      }
    }
    if (!Object.keys(trade).length) continue;

    const positive = t.English.find((v) => !isNegating(v)) ?? t.English[0]!;
    const negative = t.English.find(isNegating);
    const entry: StatMapEntry = { ids: t.ids, text: displayTemplate(positive), trade };
    if (negative) entry.negText = displayTemplate(negative);
    const transform = transformFor(positive, handlers);
    if (transform) entry.transform = transform;
    const hidden = positive.format.flatMap((f, i) => (f === 'ignore' ? [i] : []));
    if (hidden.length) entry.hidden = hidden;
    entries.push(entry);
  }
  return { generatedAt, entries };
}

export function buildBaseMap(baseItems: Record<string, RepoeBase>): BaseMap {
  const out: BaseMap = {};
  for (const [path, b] of Object.entries(baseItems)) {
    if (b.item_class in CATEGORY_BY_CLASS && b.release_state !== 'unreleased') {
      out[path] = { name: b.name, itemClass: b.item_class };
    }
  }
  return out;
}

export function coverage(
  items: PlannerItem[],
  statMap: StatMap,
): { mapped: number; total: number; ratio: number; misses: string[] } {
  const byId = new Map<string, StatMapEntry>();
  for (const e of statMap.entries) for (const id of e.ids) if (!byId.has(id)) byId.set(id, e);
  let mapped = 0;
  let total = 0;
  const misses = new Set<string>();
  for (const item of items) {
    for (const kind of KINDS) {
      for (const id of Object.keys(item.stats[kind] ?? {})) {
        total++;
        if (byId.get(id)?.trade[kind]) mapped++;
        else misses.add(`${kind}:${id}`);
      }
    }
  }
  return { mapped, total, ratio: total ? mapped / total : 1, misses: [...misses].sort() };
}

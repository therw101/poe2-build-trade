import { CATEGORY_BY_CLASS } from '../../src/core/categories.ts';
import type {
  BaseMap,
  LinkTarget,
  PlannerItem,
  StatKind,
  StatMap,
  StatMapEntry,
  TradeItemsMap,
  TradeStatText,
} from '../../src/core/types.ts';

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

export interface TradeItemsResponse {
  result: {
    id: string;
    entries: { type: string; name?: string; text?: string; flags?: { unique?: boolean } }[];
  }[];
}

export interface TradeStaticResponse {
  result: { id: string; entries: { id: string; text: string }[] }[];
}

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
      if (!isKind(kind) || e.id.includes('|')) continue;
      const key = `${kind}|${e.text.toLowerCase()}`;
      if (!index.has(key)) index.set(key, e.id);
    }
  }
  return index;
}

/** Trade stats with named options, listed as "<kind>.stat_N|<option>", e.g. anoints. */
interface OptionGroup {
  kind: StatKind;
  baseId: string;
  statKey: string;
  options: { option: string; text: string }[];
}

function optionGroups(tradeStats: TradeStatsResponse): OptionGroup[] {
  const groups = new Map<string, OptionGroup>();
  for (const group of tradeStats.result) {
    for (const e of group.entries) {
      const [baseId, option] = e.id.split('|');
      const kind = baseId?.split('.')[0] ?? '';
      if (!baseId || !option || !isKind(kind)) continue;
      let g = groups.get(baseId);
      if (!g) groups.set(baseId, (g = { kind, baseId, statKey: baseId.slice(kind.length + 1), options: [] }));
      g.options.push({ option, text: e.text });
    }
  }
  return [...groups.values()];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex capturing the option name for a single-placeholder template, e.g. /^Allocates (.+)$/i. */
function optionPattern(t: RepoeTranslation): RegExp | null {
  if (t.ids.length !== 1) return null;
  for (const v of t.English) {
    const parts = normalizeTemplate(v.string).split('#');
    // A bare "#" template would match every option group; require literal text around it.
    if (parts.length === 2 && parts.join('').trim()) return new RegExp(`^${escapeRe(parts[0]!)}(.+)${escapeRe(parts[1]!)}$`, 'i');
  }
  return null;
}

/** An option group matches when its sample texts fit the template with non-numeric names. */
function matchOptionGroup(pattern: RegExp, g: OptionGroup): Record<string, string> | null {
  const names: Record<string, string> = {};
  for (const { option, text } of g.options) {
    const name = pattern.exec(text)?.[1];
    if (!name || /^[+-]?\d/.test(name)) return null;
    names[option] = name;
  }
  return names;
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
  const groups = optionGroups(tradeStats);
  const entries: StatMapEntry[] = [];
  const options: Record<string, Record<string, string>> = {};
  const linked = new Set<OptionGroup>();

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
    let option: string | undefined;
    const pattern = Object.keys(trade).length ? null : optionPattern(t);
    if (pattern) {
      for (const g of groups) {
        if (trade[g.kind] || linked.has(g)) continue;
        const names = matchOptionGroup(pattern, g);
        if (!names) continue;
        linked.add(g);
        trade[g.kind] = g.baseId;
        option = g.statKey;
        options[g.statKey] = { ...options[g.statKey], ...names };
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
    if (option) entry.option = option;
    entries.push(entry);
  }
  return { generatedAt, entries, options };
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
        const e = byId.get(id);
        const value = String(item.stats[kind]?.[id]);
        const ok = e?.trade[kind] && (!e.option || statMap.options?.[e.option]?.[value]);
        if (ok) mapped++;
        else misses.add(`${kind}:${id}`);
      }
    }
  }
  return { mapped, total, ratio: total ? mapped / total : 1, misses: [...misses].sort() };
}

const EQUIPMENT_GROUPS = new Set(['accessory', 'armour', 'weapon', 'flask', 'jewel']);

/**
 * Maps names shown in guide links to a trade search. Bulk-exchange items win, then
 * uniques (by name), equipment bases, and everything else by type (gems, other currency).
 */
export function buildTradeItems(
  items: TradeItemsResponse,
  statics: TradeStaticResponse,
  generatedAt: string,
): TradeItemsMap {
  const byName: Record<string, LinkTarget> = {};
  const add = (name: string, t: LinkTarget) => {
    if (name && !(name in byName)) byName[name] = t;
  };
  for (const group of statics.result) {
    for (const e of group.entries) if (e.id && e.text) add(e.text, { kind: 'exchange', id: e.id });
  }
  for (const group of items.result) {
    for (const e of group.entries) {
      if (e.flags?.unique && e.name) add(e.name, { kind: 'unique', name: e.name, type: e.type });
      else if (EQUIPMENT_GROUPS.has(group.id)) add(e.type, { kind: 'base', type: e.type });
      else add(e.type, { kind: 'type', type: e.type });
    }
  }
  return { generatedAt, byName };
}

/**
 * Trade stat id → display template for popup rows built from a site's own trade filters.
 * Most ids share their wording across kinds ("explicit.stat_1" and "rune.stat_1"), so the
 * text is stored once under "stat_1"; a full id key is added only where a kind differs.
 */
export function buildTradeStatText(stats: TradeStatsResponse, generatedAt: string): TradeStatText {
  const text: Record<string, string> = {};
  const seen = new Set<string>();
  for (const group of stats.result) {
    for (const e of group.entries) {
      // A few ids are listed twice with different wording; keep the first listing.
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const key = e.id.slice(e.id.indexOf('.') + 1);
      if (!(key in text)) text[key] = e.text;
      else if (text[key] !== e.text) text[e.id] = e.text;
    }
  }
  return { generatedAt, text };
}

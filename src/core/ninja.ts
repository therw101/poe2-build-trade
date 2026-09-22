import { categoryFor } from './categories.ts';
import type { StatIndex } from './statmap.ts';
import { matchModText, plainText, type TextIndex } from './textmods.ts';
import type { BaseMap, ItemModel, ModRow, NinjaItem, Rarity, StatKind } from './types.ts';

export interface BaseInfo {
  name: string;
  itemClass: string;
  implicits: number;
}

/** Equipment bases by display name (poe.ninja gives names, not metadata paths). */
export type BasesByName = Map<string, BaseInfo>;

export function basesByName(bases: BaseMap): BasesByName {
  const out: BasesByName = new Map();
  for (const b of Object.values(bases)) {
    if (!out.has(b.name)) out.set(b.name, { name: b.name, itemClass: b.itemClass, implicits: b.implicits ?? 0 });
  }
  return out;
}

const RARITY: Record<number, Rarity> = { 0: 'normal', 1: 'magic', 2: 'rare', 3: 'unique' };

/** Item properties that PoB exports among the mods ("Energy Shield: 322", "Rune: Owl Idol"). */
const PROPERTY_LINE =
  /^(Energy Shield|Ward|Sockets|Rune|Armour|Evasion Rating|Quality|Grants Skill|Spirit|Charm Slots|Item Level|Requires|Limited to|Radius|Physical Damage|Elemental Damage|Chaos Damage|Critical Hit Chance|Attacks per Second|Reload Time|Block chance): /i;
/** PoB kind tags in front of a mod line, e.g. "{enchant}Allocates Multitasking". */
const KIND_TAG = /^\{(\w+)\}/;
const TAG_KIND: Record<string, StatKind> = {
  enchant: 'enchant',
  implicit: 'implicit',
  fractured: 'fractured',
  rune: 'rune',
  crafted: 'explicit',
};
/** Trade kinds to try per row kind: crafted and desecrated mods list as explicit on trade. */
const TRADE_KINDS: Record<StatKind, StatKind[]> = {
  explicit: ['explicit'],
  implicit: ['implicit'],
  fractured: ['fractured', 'explicit'],
  crafted: ['explicit'],
  enchant: ['enchant'],
  rune: ['rune'],
};

function findBase(item: NinjaItem, bases: BasesByName): BaseInfo | null {
  const exact = bases.get(item.baseType);
  if (exact) return exact;
  // Magic items keep their affixes in baseType; take the longest base name inside it.
  let best: BaseInfo | null = null;
  for (const b of bases.values()) {
    if (item.baseType.includes(b.name) && (!best || b.name.length > best.name.length)) best = b;
  }
  return best;
}

const fillOne = (template: string, value: number) =>
  template.replace(/\+?#/, (t) => (t.startsWith('+') && value >= 0 ? `+${value}` : String(value)));

/**
 * Converts a poe.ninja item with display-text mods to the shared item model. PoB's
 * implicit bucket also holds explicit mods, so only as many lines as the base has
 * implicits count as implicit; the rest are explicit.
 */
export function ninjaToModel(item: NinjaItem, texts: TextIndex, stats: StatIndex, bases: BasesByName): ItemModel {
  const base = findBase(item, bases);
  const itemClass = base?.itemClass ?? null;
  const category = categoryFor(itemClass);
  const preferLocal = !!category && (category.startsWith('weapon.') || category.startsWith('armour.'));
  const rarity = RARITY[item.frameType] ?? 'normal';

  const lines: { text: string; kind: StatKind }[] = [];
  let sockets = 0;
  const take = (list: string[] | undefined, kind: StatKind, implicitSlots = 0) => {
    let slots = implicitSlots;
    for (const raw of list ?? []) {
      const tag = raw.match(KIND_TAG)?.[1]?.toLowerCase();
      const text = plainText(raw.replace(KIND_TAG, ''));
      if (/^Sockets: /i.test(text)) sockets = Math.max(sockets, (text.match(/\bS\b/g) ?? []).length);
      if (!text || PROPERTY_LINE.test(text)) continue;
      if (tag && TAG_KIND[tag]) lines.push({ text, kind: TAG_KIND[tag] });
      else if (slots > 0) {
        slots--;
        lines.push({ text, kind: 'implicit' });
      } else lines.push({ text, kind });
    }
  };
  take(item.enchantMods, 'enchant');
  take(item.implicitMods, 'explicit', base?.implicits ?? 0);
  take(item.fracturedMods, 'fractured');
  take(item.explicitMods, 'explicit');
  take(item.craftedMods, 'explicit');
  take(item.desecratedMods, 'explicit');
  take(item.runeMods, 'rune');

  const mods: ModRow[] = [];
  const byTradeId = new Map<string, ModRow>();
  for (const { text, kind } of lines) {
    // Bonded rune lines read like normal mods once the prefix is dropped.
    const m = matchModText(texts, text.replace(/^Bonded: /, ''), preferLocal);
    const tradeKind = m && TRADE_KINDS[kind].find((k) => m.entry.trade[k]);
    let tradeId = tradeKind ? m.entry.trade[tradeKind]! : null;
    if (tradeId && m?.option !== undefined) tradeId = stats.options[m.entry.option!]?.[m.option] ? `${tradeId}|${m.option}` : null;

    const same = tradeId && m?.numeric ? byTradeId.get(tradeId) : undefined;
    if (same && m) {
      // Trade filters compare the item's total for a stat, so repeats add up.
      same.value = Math.round((same.value + m.value) * 100) / 100;
      if ((m.entry.text.match(/#/g) ?? []).length === 1) same.text = fillOne(m.entry.text, same.value);
      continue;
    }
    const row: ModRow = { kind, text, value: m?.value ?? 0, numeric: m?.numeric ?? false, tradeId };
    if (tradeId && m?.numeric) byTradeId.set(tradeId, row);
    mods.push(row);
  }

  return {
    rarity,
    name: item.name || item.typeLine || item.baseType,
    baseName: base?.name ?? item.baseType,
    itemClass,
    category,
    sockets,
    mods: rarity === 'unique' || rarity === 'normal' ? [] : mods,
  };
}

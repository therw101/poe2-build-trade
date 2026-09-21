export type StatKind = 'explicit' | 'implicit' | 'enchant' | 'crafted' | 'fractured' | 'rune';
export const STAT_KINDS: readonly StatKind[] = [
  'explicit',
  'fractured',
  'crafted',
  'implicit',
  'enchant',
  'rune',
];

export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';
export type TradeStatus = 'online' | 'available' | 'any';

/** Item object as stored by the maxroll planner (API and paperdoll React props). */
export interface PlannerItem {
  base: string;
  rarity: Rarity;
  name: string;
  sockets?: string[];
  stats: Partial<Record<StatKind, Record<string, number>>>;
}

export interface StatMapEntry {
  /** Game stat ids that share one translation, in template order. */
  ids: string[];
  /** Display template for positive values, e.g. "+# to maximum Life". */
  text: string;
  /** Display template for negative values, e.g. "#% reduced Cast Speed". */
  negText?: string;
  /** Trade stat id per kind, e.g. { explicit: "explicit.stat_3299347043" }. */
  trade: Partial<Record<StatKind, string>>;
  /**
   * Per-id conversion from the raw game value to the displayed value
   * (displayed = raw * f + a), aligned with `ids`. Omitted when every id is identity.
   */
  transform?: { f: number; a: number }[];
}

export interface StatMap {
  generatedAt: string;
  entries: StatMapEntry[];
}

export type BaseMap = Record<string, { name: string; itemClass: string }>;

export interface ModRow {
  kind: StatKind;
  /** Filled display text, e.g. "64% increased Spell Damage". */
  text: string;
  /** Value used for trade: mean of the component stat values. */
  value: number;
  tradeId: string | null;
}

export interface ItemModel {
  rarity: Rarity;
  name: string;
  baseName: string | null;
  itemClass: string | null;
  category: string | null;
  sockets: number;
  mods: ModRow[];
}

export interface ModSelection {
  tradeId: string;
  min: number | null;
  max: number | null;
}

export type MatchMode = { type: 'and' } | { type: 'count'; min: number };

export interface SearchSelection {
  baseMode: 'category' | 'exact';
  mods: ModSelection[];
  match: MatchMode;
  runeSockets: number | null;
  status: TradeStatus;
}

export interface StatFilter {
  id: string;
  value?: { min?: number; max?: number };
}

export interface StatGroup {
  type: 'and' | 'count';
  value?: { min: number };
  filters: StatFilter[];
}

export interface TradeQuery {
  status: { option: TradeStatus };
  name?: string;
  type?: string;
  stats: StatGroup[];
  filters?: {
    type_filters?: { filters: { category?: { option: string }; rarity?: { option: string } } };
    equipment_filters?: { filters: { rune_sockets?: { min: number } } };
  };
}

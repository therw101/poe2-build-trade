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
  /** Missing on some magic/normal items in the paperdoll. */
  name?: string;
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
  /** Indices of `ids` that the template does not display (format "ignore"). */
  hidden?: number[];
  /**
   * Set for option stats (e.g. anoints: "Allocates #"), whose value picks a named option.
   * Key into `StatMap.options`; the trade filter id is `${trade[kind]}|${value}`.
   */
  option?: string;
}

export interface StatMap {
  generatedAt: string;
  entries: StatMapEntry[];
  /** Option names per trade stat key, e.g. { stat_2954116742: { "16790": "Efficient Casting" } }. */
  options?: Record<string, Record<string, string>>;
}

export type BaseMap = Record<string, { name: string; itemClass: string }>;

export interface ModRow {
  kind: StatKind;
  /** Filled display text, e.g. "64% increased Spell Damage". */
  text: string;
  /** Value used for trade: mean of the component stat values. */
  value: number;
  /** False for flag-like mods whose text has no number (searched by presence only). */
  numeric: boolean;
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

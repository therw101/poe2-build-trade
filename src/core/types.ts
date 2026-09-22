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

/** Popup row group: a game stat kind, or a trade pseudo stat chosen by a build site. */
export type RowKind = StatKind | 'pseudo';

export interface ModRow {
  kind: RowKind;
  /** Filled display text, e.g. "64% increased Spell Damage". */
  text: string;
  /** Value used for trade: mean of the component stat values. */
  value: number;
  /** False for flag-like mods whose text has no number (searched by presence only). */
  numeric: boolean;
  tradeId: string | null;
  /**
   * Bounds already chosen by the build site (mobalytics guide filters). Rows with a
   * preset start checked and keep these bounds instead of scaling `value` by minPct.
   */
  preset?: { min: number | null; max: number | null };
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

/** How an inline guide link (gem, currency, unique, base) is searched on trade. */
export type LinkTarget =
  | { kind: 'exchange'; id: string }
  | { kind: 'unique'; name: string; type: string }
  | { kind: 'type'; type: string }
  | { kind: 'base'; type: string };

export interface TradeItemsMap {
  generatedAt: string;
  /** Display name as shown on maxroll (data-poe2-text) → search target. */
  byName: Record<string, LinkTarget>;
}

export type ExchangeStatus = 'online' | 'any';

export interface ExchangeQuery {
  status: { option: ExchangeStatus };
  want: string[];
  have: string[];
}

/** Trade stat id → display template, e.g. "stat_3299347043" → "# to maximum Life". */
export interface TradeStatText {
  generatedAt: string;
  /** Keyed by the part after the kind prefix; a full id key overrides it for that kind. */
  text: Record<string, string>;
}

/** Item as rendered by a mobalytics guide paperdoll (React props `data[slot].equipmentItem`). */
export interface MobaEquipmentItem {
  /** Unique name (sometimes with a variant, "Morior Invictus (life)") or base name; absent on jewels. */
  name?: string;
  isUnique: boolean;
  itemClassSlug?: string | null;
  explicitDescriptions?: { description: string }[] | null;
  /** The guide's own trade search, a JSON string `{"query": TradeQuery-like, "sort": …}`. */
  poe2TradeRequest?: { query: string } | null;
}

export interface MobaSlot {
  equipmentItem: MobaEquipmentItem;
  runes?: unknown[] | null;
}

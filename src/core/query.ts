import type {
  ItemModel,
  ModRow,
  ModSelection,
  SearchSelection,
  StatFilter,
  TradeQuery,
  TradeStatus,
} from './types.ts';

export interface RowState {
  row: ModRow;
  checked: boolean;
  min: number | null;
  max: number | null;
}

/** Values this small (skill levels, flat +1/+2) are searched exactly instead of scaled. */
const EXACT_BELOW = 5;

function defaultBounds(row: ModRow, minPct: number): { min: number | null; max: number | null } {
  if (!row.numeric) return { min: null, max: null };
  const v = row.value;
  if (Math.abs(v) <= EXACT_BELOW) {
    const exact = Math.round(v);
    return v < 0 ? { min: null, max: exact } : { min: exact, max: null };
  }
  return v < 0 ? { min: null, max: Math.ceil(v * minPct) } : { min: Math.floor(v * minPct), max: null };
}

export function defaultRowStates(model: ItemModel, minPct: number): RowState[] {
  return model.mods.map((row) => ({
    row,
    checked: row.kind === 'explicit' && row.tradeId !== null,
    ...defaultBounds(row, minPct),
  }));
}

export function selectionFromRows(rows: RowState[]): ModSelection[] {
  return rows
    .filter((r) => r.checked && r.row.tradeId !== null)
    .map((r) => ({ tradeId: r.row.tradeId!, min: r.min, max: r.max }));
}

function statFilter(m: ModSelection): StatFilter {
  const value: { min?: number; max?: number } = {};
  if (m.min !== null) value.min = m.min;
  if (m.max !== null) value.max = m.max;
  return Object.keys(value).length ? { id: m.tradeId, value } : { id: m.tradeId };
}

export function buildQuery(model: ItemModel, sel: SearchSelection): TradeQuery {
  const filters = sel.mods.map(statFilter);
  const q: TradeQuery = {
    status: { option: sel.status },
    stats: [
      sel.match.type === 'count'
        ? { type: 'count', value: { min: sel.match.min }, filters }
        : { type: 'and', filters },
    ],
  };

  const useCategory = sel.baseMode === 'category' && model.category !== null;
  if (!useCategory && model.baseName) q.type = model.baseName;
  q.filters = {
    type_filters: {
      filters: {
        ...(useCategory ? { category: { option: model.category! } } : {}),
        rarity: { option: 'nonunique' },
      },
    },
  };
  if (sel.runeSockets !== null) {
    q.filters.equipment_filters = { filters: { rune_sockets: { min: sel.runeSockets } } };
  }
  return q;
}

/** One-click search for uniques (by name) and normal items (by base). */
export function buildDirectQuery(model: ItemModel, status: TradeStatus): TradeQuery {
  const q: TradeQuery = { status: { option: status }, stats: [{ type: 'and', filters: [] }] };
  if (model.rarity === 'unique' && model.name) q.name = model.name;
  if (model.baseName) q.type = model.baseName;
  return q;
}

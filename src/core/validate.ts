import type { MobaSlot, PlannerItem, StatMap, TradeItemsMap, TradeStatText } from './types.ts';

const RARITIES = new Set(['normal', 'magic', 'rare', 'unique']);

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** Guards against maxroll changing its planner item shape. */
export function isPlannerItem(x: unknown): x is PlannerItem {
  return (
    isRecord(x) &&
    typeof x.base === 'string' &&
    typeof x.rarity === 'string' &&
    RARITIES.has(x.rarity) &&
    (x.name === undefined || typeof x.name === 'string') &&
    isRecord(x.stats) &&
    Object.values(x.stats).every(
      (group) => isRecord(group) && Object.values(group).every((v) => typeof v === 'number'),
    )
  );
}

const isStatMapEntry = (e: unknown) =>
  isRecord(e) && Array.isArray(e.ids) && typeof e.text === 'string' && isRecord(e.trade);

/** Validates remote data before it replaces the bundled snapshot. */
export function isStatMap(x: unknown): x is StatMap {
  return (
    isRecord(x) &&
    typeof x.generatedAt === 'string' &&
    Array.isArray(x.entries) &&
    x.entries.length > 0 &&
    x.entries.every(isStatMapEntry) &&
    (x.options === undefined || isRecord(x.options))
  );
}

const LINK_KINDS = new Set(['exchange', 'unique', 'type', 'base']);

export function isTradeItemsMap(x: unknown): x is TradeItemsMap {
  if (!isRecord(x) || typeof x.generatedAt !== 'string' || !isRecord(x.byName)) return false;
  const values = Object.values(x.byName);
  return values.length > 0 && values.every((t) => isRecord(t) && typeof t.kind === 'string' && LINK_KINDS.has(t.kind));
}

export function isTradeStatText(x: unknown): x is TradeStatText {
  if (!isRecord(x) || typeof x.generatedAt !== 'string' || !isRecord(x.text)) return false;
  const values = Object.values(x.text);
  return values.length > 0 && values.every((v) => typeof v === 'string');
}

/** Shape check for a mobalytics paperdoll slot read from React props. */
export function isMobaSlot(x: unknown): x is MobaSlot {
  if (!isRecord(x) || !isRecord(x.equipmentItem)) return false;
  const item = x.equipmentItem;
  const req = item.poe2TradeRequest;
  return (
    (item.name === undefined || typeof item.name === 'string') &&
    typeof item.isUnique === 'boolean' &&
    (req === undefined || req === null || (isRecord(req) && typeof req.query === 'string')) &&
    (x.runes === undefined || x.runes === null || Array.isArray(x.runes))
  );
}

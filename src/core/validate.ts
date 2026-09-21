import type { PlannerItem, StatMap } from './types.ts';

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

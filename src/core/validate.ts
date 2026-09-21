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
    typeof x.name === 'string' &&
    isRecord(x.stats) &&
    Object.values(x.stats).every(
      (group) => isRecord(group) && Object.values(group).every((v) => typeof v === 'number'),
    )
  );
}

export function isStatMap(x: unknown): x is StatMap {
  return isRecord(x) && typeof x.generatedAt === 'string' && Array.isArray(x.entries);
}

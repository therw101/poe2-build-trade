import type { StatMap, StatMapEntry } from './types.ts';

/** Game stat id → the first stat map entry that contains it. */
export type StatIndex = Map<string, StatMapEntry>;

export function indexStatMap(m: StatMap): StatIndex {
  const index: StatIndex = new Map();
  for (const e of m.entries) {
    for (const id of e.ids) if (!index.has(id)) index.set(id, e);
  }
  return index;
}

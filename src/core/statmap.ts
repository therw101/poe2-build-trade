import type { StatMap, StatMapEntry } from './types.ts';

export interface StatIndex {
  /** Game stat id → the first stat map entry that contains it. */
  byId: Map<string, StatMapEntry>;
  options: NonNullable<StatMap['options']>;
}

export function indexStatMap(m: StatMap): StatIndex {
  const byId = new Map<string, StatMapEntry>();
  for (const e of m.entries) {
    for (const id of e.ids) if (!byId.has(id)) byId.set(id, e);
  }
  return { byId, options: m.options ?? {} };
}

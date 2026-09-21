import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDirectQuery, buildQuery, defaultRowStates, selectionFromRows } from '../src/core/query.ts';
import { indexStatMap } from '../src/core/statmap.ts';
import { toItemModel } from '../src/core/translate.ts';
import type { BaseMap, ItemModel, PlannerItem, StatMap } from '../src/core/types.ts';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const items: Record<string, PlannerItem> = JSON.parse(read('tests/fixtures/planner-z7coxn0y.json').data).items;
const stats = indexStatMap(read('data/stat-map.json') as StatMap);
const bases = read('data/base-map.json') as BaseMap;
const model = (id: string): ItemModel => toItemModel(items[id]!, stats, bases);

const SPELL = 'explicit.stat_2974417149';
const LEVELS = 'explicit.stat_124131830';
const CAST = 'explicit.stat_2891184298';

describe('defaultRowStates', () => {
  it('checks mapped explicit mods and scales min by minPct', () => {
    const rows = defaultRowStates(model('32'), 0.8);
    const byId = (id: string) => rows.find((r) => r.row.tradeId === id);
    expect(byId(SPELL)).toMatchObject({ checked: true, min: 51, max: null });
    expect(byId(LEVELS)).toMatchObject({ checked: true, min: 2, max: null });
    expect(byId(CAST)).toMatchObject({ checked: true, min: 11, max: null });
    expect(rows.find((r) => r.row.kind === 'rune')?.checked).toBe(false);
  });

  it('never checks unmapped rows', () => {
    const rows = defaultRowStates(model('178'), 0.8);
    expect(rows.find((r) => r.row.tradeId === null)?.checked).toBe(false);
  });

  it('uses max for negative values', () => {
    const m = model('32');
    const neg: ItemModel = { ...m, mods: [{ ...m.mods[0]!, value: -20 }] };
    expect(defaultRowStates(neg, 0.8)[0]).toMatchObject({ min: null, max: -16 });
  });

  it('leaves bounds empty for non-numeric mods', () => {
    const flag = defaultRowStates(model('162'), 0.8).find((r) => !r.row.numeric);
    expect(flag).toMatchObject({ min: null, max: null });
  });
});

describe('buildQuery', () => {
  const wand = model('32');
  const mods = selectionFromRows(defaultRowStates(wand, 0.8));

  it('builds the category query verified in the spike', () => {
    const q = buildQuery(wand, { baseMode: 'category', mods, match: { type: 'and' }, runeSockets: null, status: 'available' });
    expect(q).toEqual({
      status: { option: 'available' },
      stats: [
        {
          type: 'and',
          filters: [
            { id: SPELL, value: { min: 51 } },
            { id: LEVELS, value: { min: 2 } },
            { id: CAST, value: { min: 11 } },
          ],
        },
      ],
      filters: {
        type_filters: { filters: { category: { option: 'weapon.wand' }, rarity: { option: 'nonunique' } } },
      },
    });
  });

  it('uses the exact base name in exact mode', () => {
    const q = buildQuery(wand, { baseMode: 'exact', mods, match: { type: 'and' }, runeSockets: null, status: 'online' });
    expect(q.type).toBe('Attuned Wand');
    expect(q.filters?.type_filters?.filters.category).toBeUndefined();
    expect(q.status.option).toBe('online');
  });

  it('builds a count group and rune socket filter', () => {
    const q = buildQuery(wand, { baseMode: 'category', mods, match: { type: 'count', min: 2 }, runeSockets: 1, status: 'available' });
    expect(q.stats[0]).toMatchObject({ type: 'count', value: { min: 2 } });
    expect(q.filters?.equipment_filters).toEqual({ filters: { rune_sockets: { min: 1 } } });
  });

  it('omits value for mods without bounds', () => {
    const q = buildQuery(wand, {
      baseMode: 'category',
      mods: [{ tradeId: 'explicit.stat_1056492907', min: null, max: null }],
      match: { type: 'and' },
      runeSockets: null,
      status: 'available',
    });
    expect(q.stats[0]?.filters).toEqual([{ id: 'explicit.stat_1056492907' }]);
  });

  it('falls back to exact base when the class has no category', () => {
    const q = buildQuery({ ...wand, category: null }, { baseMode: 'category', mods, match: { type: 'and' }, runeSockets: null, status: 'available' });
    expect(q.type).toBe('Attuned Wand');
  });
});

describe('buildDirectQuery', () => {
  it('searches uniques by name and base', () => {
    expect(buildDirectQuery(model('316'), 'available')).toEqual({
      status: { option: 'available' },
      name: 'Mageblood',
      type: 'Utility Belt',
      stats: [{ type: 'and', filters: [] }],
    });
  });

  it('searches normal items by base only', () => {
    const q = buildDirectQuery({ ...model('32'), rarity: 'normal' }, 'available');
    expect(q).toEqual({ status: { option: 'available' }, type: 'Attuned Wand', stats: [{ type: 'and', filters: [] }] });
  });
});

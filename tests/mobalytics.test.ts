import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildTradeItems,
  buildTradeStatText,
  type TradeItemsResponse,
  type TradeStaticResponse,
  type TradeStatsResponse,
} from '../scripts/lib/build-data-lib.ts';
import { mobaToModel, statTemplate } from '../src/core/mobalytics.ts';
import { buildDirectQuery, buildQuery, defaultRowStates, selectionFromRows } from '../src/core/query.ts';
import type { MobaSlot } from '../src/core/types.ts';
import { isMobaSlot, isTradeStatText } from '../src/core/validate.ts';

const read = (p: string) => JSON.parse(readFileSync(`tests/fixtures/${p}`, 'utf8'));
const statText = buildTradeStatText(read('trade-stats.json') as TradeStatsResponse, '2026-09-22T00:00:00.000Z');
const tradeItems = buildTradeItems(
  read('trade-items.json') as TradeItemsResponse,
  read('trade-static.json') as TradeStaticResponse,
  '2026-09-22T00:00:00.000Z',
);
const variants = read('mobalytics-equipment.json').variants as Record<string, Record<string, MobaSlot>>;
const endgame = variants['ec6511a2-8023-4841-b1a2-731bf5fdcd93']!;
const leveling = variants['default-variant']!;
const model = (slot: MobaSlot) => mobaToModel(slot, statText, tradeItems);

describe('buildTradeStatText', () => {
  it('maps trade stat ids to their display template', () => {
    expect(isTradeStatText(statText)).toBe(true);
    expect(statTemplate(statText, 'explicit.stat_3299347043')).toBe('# to maximum Life');
    expect(statTemplate(statText, 'rune.stat_3299347043')).toBe('# to maximum Life');
    expect(statTemplate(statText, 'pseudo.pseudo_total_elemental_resistance')).toBe('+#% total Elemental Resistance');
    expect(statTemplate(statText, 'explicit.stat_0')).toBeNull();
  });

  it('keeps kind-specific wording where kinds disagree', () => {
    // Trade lists a few ids twice (e.g. "in Map" / "in this Area"); the first listing wins.
    const first = new Map<string, string>();
    const stats = read('trade-stats.json') as TradeStatsResponse;
    for (const group of stats.result) for (const e of group.entries) if (!first.has(e.id)) first.set(e.id, e.text);
    for (const [id, text] of first) expect(statTemplate(statText, id)).toBe(text);
  });
});

describe('mobaToModel', () => {
  it('fixture slots match the live props shape', () => {
    for (const slot of [...Object.values(endgame), ...Object.values(leveling)]) expect(isMobaSlot(slot)).toBe(true);
  });

  it('turns guide filters into preset popup rows', () => {
    const m = model(endgame.body!);
    expect(m).toMatchObject({
      rarity: 'rare',
      name: 'Dastard Armour',
      baseName: 'Dastard Armour',
      itemClass: 'Body Armour',
      category: 'armour.chest',
      sockets: 2,
    });
    expect(m.mods).toHaveLength(6);
    expect(m.mods[2]).toEqual({
      kind: 'explicit',
      text: '# to maximum Life',
      value: 40,
      numeric: true,
      tradeId: 'explicit.stat_3299347043',
      preset: { min: 40, max: null },
    });
    expect(m.mods[3]).toMatchObject({
      kind: 'pseudo',
      text: '+#% total Elemental Resistance',
      tradeId: 'pseudo.pseudo_total_elemental_resistance',
      preset: { min: 72, max: null },
    });
  });

  it('keeps the guide minimums instead of scaling them', () => {
    const m = model(endgame.body!);
    const rows = defaultRowStates(m, 0.8);
    expect(rows.every((r) => r.checked)).toBe(true);
    expect(rows.map((r) => r.min)).toEqual([150, 142, 40, 72, 92, 32]);
    const q = buildQuery(m, {
      baseMode: 'category',
      mods: selectionFromRows(rows),
      match: { type: 'and' },
      runeSockets: null,
      status: 'available',
    });
    expect(q.stats[0]!.filters[3]).toEqual({ id: 'pseudo.pseudo_total_elemental_resistance', value: { min: 72 } });
    expect(q.filters?.type_filters?.filters).toEqual({ category: { option: 'armour.chest' }, rarity: { option: 'nonunique' } });
  });

  it('searches uniques by name and trade base type', () => {
    const m = model(endgame.belt!);
    expect(m).toMatchObject({ rarity: 'unique', name: 'Mageblood', mods: [] });
    expect(buildDirectQuery(m, 'online')).toEqual({
      status: { option: 'online' },
      name: 'Mageblood',
      type: tradeItems.byName.Mageblood?.kind === 'unique' ? tradeItems.byName.Mageblood.type : undefined,
      stats: [{ type: 'and', filters: [] }],
    });
  });

  it('searches items without guide filters by base', () => {
    const m = model(leveling.rightRing!);
    expect(m).toMatchObject({ rarity: 'normal', baseName: 'Iron Ring', mods: [] });
    expect(buildDirectQuery(m, 'online').type).toBe('Iron Ring');
  });

  it('shows the raw id for stats trade no longer lists', () => {
    const slot = structuredClone(leveling.helmet!);
    slot.equipmentItem.poe2TradeRequest = {
      query: JSON.stringify({ query: { stats: [{ type: 'and', filters: [{ id: 'explicit.stat_0', value: { max: 5 } }] }] } }),
    };
    const m = model(slot);
    expect(m.mods).toEqual([
      { kind: 'explicit', text: 'explicit.stat_0', value: 5, numeric: true, tradeId: 'explicit.stat_0', preset: { min: null, max: 5 } },
    ]);
    expect(defaultRowStates(m, 0.8)[0]).toMatchObject({ checked: true, min: null, max: 5 });
  });

  it('treats an unreadable guide query as no filters', () => {
    const slot = structuredClone(leveling.helmet!);
    slot.equipmentItem.poe2TradeRequest = { query: 'not json' };
    expect(model(slot)).toMatchObject({ rarity: 'normal', baseName: 'Face Mask', mods: [] });
  });
});

describe('mobaToModel edge cases seen on live guides', () => {
  const guide = (item: object, query: object) =>
    ({ runes: null, equipmentItem: { isUnique: false, ...item, poe2TradeRequest: { query: JSON.stringify({ query }) } } }) as MobaSlot;

  it('uses the trade name for unique variants', () => {
    const slot = guide({ name: 'Morior Invictus (life)', isUnique: true }, { name: 'Morior Invictus', stats: [] });
    expect(model(slot)).toMatchObject({ rarity: 'unique', name: 'Morior Invictus' });
    const noQuery = { runes: null, equipmentItem: { name: 'Morior Invictus (life)', isUnique: true } } as MobaSlot;
    expect(model(noQuery).name).toBe('Morior Invictus');
  });

  it('searches jewels, which have no name, by category', () => {
    const slot = guide(
      { jewelSlug: 'jewel-jewelint' },
      {
        stats: [{ type: 'and', filters: [{ id: 'explicit.stat_2968503605', value: { min: 10 } }] }],
        filters: { type_filters: { filters: { category: { option: 'jewel' } } } },
      },
    );
    expect(isMobaSlot(slot)).toBe(true);
    const m = model(slot);
    expect(m).toMatchObject({ rarity: 'rare', name: 'Jewel', baseName: null, itemClass: 'Jewel', category: 'jewel' });
    const q = buildQuery(m, {
      baseMode: 'category',
      mods: selectionFromRows(defaultRowStates(m, 0.8)),
      match: { type: 'and' },
      runeSockets: null,
      status: 'online',
    });
    expect(q.type).toBeUndefined();
    expect(q.filters?.type_filters?.filters.category).toEqual({ option: 'jewel' });
  });
});

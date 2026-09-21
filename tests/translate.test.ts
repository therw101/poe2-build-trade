import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { indexStatMap } from '../src/core/statmap.ts';
import { toItemModel } from '../src/core/translate.ts';
import type { BaseMap, PlannerItem, StatMap } from '../src/core/types.ts';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const items: Record<string, PlannerItem> = JSON.parse(read('tests/fixtures/planner-z7coxn0y.json').data).items;
const stats = indexStatMap(read('public/data/stat-map.json') as StatMap);
const bases = read('public/data/base-map.json') as BaseMap;
const model = (id: string) => toItemModel(items[id]!, stats, bases);

describe('toItemModel', () => {
  it('translates a rare wand with a rune', () => {
    const m = model('32');
    expect(m.rarity).toBe('rare');
    expect(m.baseName).toBe('Attuned Wand');
    expect(m.itemClass).toBe('Wand');
    expect(m.category).toBe('weapon.wand');
    expect(m.sockets).toBe(1);
    const explicit = m.mods.filter((r) => r.kind === 'explicit');
    expect(explicit).toHaveLength(3);
    const spell = explicit.find((r) => r.tradeId === 'explicit.stat_2974417149');
    expect(spell).toMatchObject({ value: 64, text: '64% increased Spell Damage' });
    expect(explicit.find((r) => r.tradeId === 'explicit.stat_124131830')?.text).toBe(
      '+2 to Level of all Spell Skills',
    );
    expect(m.mods.at(-1)?.kind).toBe('rune');
  });

  it('handles items without a name', () => {
    const { name: _name, ...unnamed } = items['32']!;
    expect(toItemModel(unnamed, stats, bases).name).toBe('');
  });

  it('resolves anoint enchants to the trade option id', () => {
    const enchant = model('178').mods.find((r) => r.kind === 'enchant');
    expect(enchant).toMatchObject({
      tradeId: 'enchant.stat_2954116742|16790',
      text: 'Allocates Efficient Casting',
      numeric: false,
    });
  });

  it('marks stats without a translation as unmapped', () => {
    const item: PlannerItem = { ...items['32']!, stats: { explicit: { not_a_real_stat: 3 } } };
    const [row] = toItemModel(item, stats, bases).mods;
    expect(row).toMatchObject({ tradeId: null, text: 'not a real stat', value: 3 });
  });

  it('keeps unique name and base', () => {
    const m = model('316');
    expect(m).toMatchObject({ rarity: 'unique', name: 'Mageblood', baseName: 'Utility Belt' });
  });

  it('merges min/max added damage into one row using the mean', () => {
    const rows = model('309').mods.filter((r) => r.tradeId === 'explicit.stat_3032590688');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 12, text: 'Adds 7 to 17 Physical Damage to Attacks' });
  });

  it('flags mods without a number as non-numeric', () => {
    const flag = model('162').mods.find((r) => r.text === 'Energy Shield Recharge starts on use');
    expect(flag).toMatchObject({ numeric: false, tradeId: 'explicit.stat_1056492907' });
    expect(model('32').mods.every((r) => r.numeric)).toBe(true);
  });

  it('orders rows explicit first and implicit before enchant', () => {
    const kinds = model('178').mods.map((r) => r.kind);
    expect(kinds).toEqual(['explicit', 'explicit', 'implicit', 'enchant']);
  });

  it('uses the negative template for negative values', () => {
    const item: PlannerItem = {
      ...items['32']!,
      stats: { explicit: { 'base_cast_speed_+%': -10 } },
    };
    const [row] = toItemModel(item, stats, bases).mods;
    expect(row).toMatchObject({ value: -10, text: '10% reduced Cast Speed', tradeId: 'explicit.stat_2891184298' });
  });

  it('converts per-minute values to the displayed per-second value', () => {
    const item: PlannerItem = {
      ...items['32']!,
      stats: { explicit: { base_life_regeneration_rate_per_minute: 300 } },
    };
    const [row] = toItemModel(item, stats, bases).mods;
    expect(row).toMatchObject({ value: 5, text: '5 Life Regeneration per second' });
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildBaseMap,
  buildStatMap,
  coverage,
  normalizeTemplate,
  type RepoeTranslation,
  type TradeStatsResponse,
  type ValueHandlers,
} from '../scripts/lib/build-data-lib.ts';
import type { PlannerItem } from '../src/core/types.ts';

const load = (name: string) => JSON.parse(readFileSync(`tests/fixtures/${name}`, 'utf8'));
const translations: RepoeTranslation[] = load('stat-descriptions.subset.json');
const tradeStats: TradeStatsResponse = load('trade-stats.json');
const handlers: ValueHandlers = load('stat-value-handlers.json');
const plannerItems: PlannerItem[] = Object.values(JSON.parse(load('planner-z7coxn0y.json').data).items);

const statMap = buildStatMap(translations, tradeStats, handlers, '2026-09-21T00:00:00.000Z');
const entryFor = (id: string) => statMap.entries.find((e) => e.ids.includes(id));

describe('normalizeTemplate', () => {
  it('strips link markup and replaces placeholders', () => {
    expect(normalizeTemplate('{0} to [Spirit|Spirit]')).toBe('# to Spirit');
    expect(normalizeTemplate('{0}% increased [Spell] Damage')).toBe('#% increased Spell Damage');
    expect(normalizeTemplate('Adds {0} to {1} Physical Damage')).toBe('Adds # to # Physical Damage');
  });
});

describe('buildStatMap', () => {
  it('uses trade_stats when RePoE provides them', () => {
    const e = entryFor('base_maximum_life');
    expect(e?.trade.explicit).toBe('explicit.stat_3299347043');
    expect(e?.text).toBe('+# to maximum Life');
  });

  it('falls back to matching trade text', () => {
    const e = entryFor('spell_damage_+%');
    expect(e?.trade.explicit).toBe('explicit.stat_2974417149');
    expect(e?.text).toBe('#% increased Spell Damage');
  });

  it('keeps the negative template', () => {
    expect(entryFor('base_cast_speed_+%')?.negText).toContain('reduced Cast Speed');
  });

  it('links option stats such as anoints to their trade option group', () => {
    const e = entryFor('mod_granted_passive_hash');
    expect(e?.trade.enchant).toBe('enchant.stat_2954116742');
    expect(e?.option).toBe('stat_2954116742');
    expect(statMap.options?.stat_2954116742?.['16790']).toBe('Efficient Casting');
  });

  it('only emits the six supported kinds', () => {
    for (const e of statMap.entries) {
      for (const k of Object.keys(e.trade)) {
        expect(['explicit', 'implicit', 'enchant', 'crafted', 'fractured', 'rune']).toContain(k);
      }
    }
  });
});

describe('buildBaseMap', () => {
  it('maps metadata paths to name and class', () => {
    const bases = buildBaseMap(load('base-items.subset.json'));
    expect(bases['Metadata/Items/Weapons/OneHandWeapons/Wands/FourWand3']).toEqual({
      name: 'Attuned Wand',
      itemClass: 'Wand',
    });
  });

  it('records how many implicits a base rolls with', () => {
    const bases = buildBaseMap(load('base-items.subset.json'));
    expect(bases['Metadata/Items/Rings/FourRing2']).toEqual({ name: 'Lazuli Ring', itemClass: 'Ring', implicits: 1 });
  });
});

describe('coverage', () => {
  it('maps at least 95% of the fixture build stats', () => {
    const c = coverage(plannerItems, statMap);
    expect(c.total).toBeGreaterThan(500);
    expect(c.ratio).toBeGreaterThanOrEqual(0.95);
  });
});

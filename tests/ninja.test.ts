import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { basesByName, ninjaToModel } from '../src/core/ninja.ts';
import { buildDirectQuery, defaultRowStates } from '../src/core/query.ts';
import { indexStatMap } from '../src/core/statmap.ts';
import { indexStatTexts, matchModText, textKey } from '../src/core/textmods.ts';
import type { BaseMap, NinjaItem, StatMap } from '../src/core/types.ts';
import { isNinjaItem } from '../src/core/validate.ts';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
// Bundled data: the matcher runs on exactly what ships with the extension.
const statMap = read('public/data/stat-map.json') as StatMap;
const baseMap = read('public/data/base-map.json') as BaseMap;
const texts = indexStatTexts(statMap);
const stats = indexStatMap(statMap);
const bases = basesByName(baseMap);
const items = read('tests/fixtures/ninja-pob-items.json').items as NinjaItem[];
const slot = (id: string) => items.find((i) => i.inventoryId === id)!;
const model = (item: NinjaItem) => ninjaToModel(item, texts, stats, bases);

describe('textKey / matchModText', () => {
  it('matches display text to the game template', () => {
    expect(textKey('+40% to Cold Resistance')).toBe(textKey('+#% to Cold Resistance'));
    expect(textKey('[Resistances|Chaos Resistance]')).toBe('chaos resistance');
    const m = matchModText(texts, 'Adds 7 to 19 Physical Damage to Attacks', false);
    expect(m).toMatchObject({ value: 13, numeric: true });
  });

  it('prefers local stats on weapons and armour', () => {
    const local = matchModText(texts, '+42 to maximum Energy Shield', true)!;
    const global = matchModText(texts, '+42 to maximum Energy Shield', false)!;
    expect(local.entry.ids[0]).toBe('local_energy_shield');
    expect(global.entry.ids[0]).toBe('base_maximum_energy_shield');
  });

  it('reads "reduced" lines as negative values', () => {
    expect(matchModText(texts, '25% reduced Attribute Requirements', true)).toMatchObject({ value: -25 });
  });

  it('matches option stats such as anoints by name', () => {
    expect(matchModText(texts, 'Allocates Multitasking', false)).toMatchObject({ option: 8810, numeric: false });
  });
});

describe('ninjaToModel anoint', () => {
  it('turns a PoB "{enchant}" anoint into an option filter', () => {
    const amulet = { ...slot('Amulet'), frameType: 2 };
    const row = model(amulet).mods.find((r) => r.text === 'Allocates Multitasking');
    expect(row).toMatchObject({ kind: 'enchant', tradeId: 'enchant.stat_2954116742|8810', numeric: false });
  });
});

describe('ninjaToModel (poe.ninja PoB page)', () => {
  it('fixture items pass validation', () => {
    for (const item of items) expect(isNinjaItem(item)).toBe(true);
  });

  it('maps every mod line of the non-unique items to a trade stat', () => {
    const unmapped = items
      .filter((i) => i.frameType !== 3)
      .flatMap((i) => model(i).mods.filter((r) => r.tradeId === null).map((r) => r.text));
    // Trade has no rune filter for this bonded idol effect; it shows as "not on trade".
    expect(unmapped).toEqual(['Bonded: 20% increased effect of Archon Buffs on you']);
  });

  it('builds a rare helmet: properties dropped, local stats, implicits by base', () => {
    const m = model(slot('Helm'));
    expect(m).toMatchObject({
      rarity: 'rare',
      name: 'Carrion Visage',
      baseName: 'Runeforged Kamasan Tiara',
      itemClass: 'Helmet',
      category: 'armour.helmet',
      sockets: 1,
    });
    expect(m.mods.map((r) => r.text)).not.toContain('Energy Shield: 322');
    // The helmet base has no implicits, so PoB's "implicit" lines are explicit mods.
    const es = m.mods.find((r) => r.text === '96% increased Energy Shield')!;
    expect(es).toMatchObject({ kind: 'explicit', tradeId: 'explicit.stat_4015621042', value: 96 });
    // Local flat ES from the desecrated line, not the global version.
    expect(m.mods.find((r) => r.text === '+42 to maximum Energy Shield')?.tradeId).toBe('explicit.stat_4052037485');
    expect(m.mods.filter((r) => r.kind === 'rune').map((r) => r.tradeId)).toEqual([
      'rune.stat_3377888098',
      expect.stringMatching(/^rune\.stat_/),
    ]);
  });

  it('keeps real base implicits as implicit rows', () => {
    const m = model(slot('Ring2'));
    const implicit = m.mods.filter((r) => r.kind === 'implicit');
    expect(implicit).toEqual([
      expect.objectContaining({ text: '8% increased Cast Speed', tradeId: 'implicit.stat_2891184298', value: 8 }),
    ]);
  });

  it('merges repeated explicit stats into one row with the total', () => {
    const m = model(slot('Ring2'));
    const rarity = m.mods.filter((r) => r.tradeId === 'explicit.stat_3917489142');
    expect(rarity).toHaveLength(1);
    expect(rarity[0]).toMatchObject({ value: 34, text: '34% increased Rarity of Items found' });
  });

  it('checks explicit rows and scales them like maxroll items', () => {
    const rows = defaultRowStates(model(slot('Gloves')), 0.8);
    const life = rows.find((r) => r.row.text === '+28 to maximum Life')!;
    expect(life).toMatchObject({ checked: true, min: 22 });
    expect(rows.find((r) => r.row.kind === 'rune')?.checked).toBe(false);
  });

  it('finds the base of magic items whose type line carries affixes', () => {
    const m = model(items.find((i) => i.typeLine === 'Potent Ultimate Life Flask of the Endless')!);
    expect(m).toMatchObject({ rarity: 'magic', baseName: 'Ultimate Life Flask', category: 'flask.life' });
  });

  it('searches uniques by name and base', () => {
    const m = model(slot('BodyArmour'));
    expect(buildDirectQuery(m, 'online')).toEqual({
      status: { option: 'online' },
      name: 'Temporalis',
      type: 'Silk Robe',
      stats: [{ type: 'and', filters: [] }],
    });
  });
});

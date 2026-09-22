import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findItemInFiber, findMobaSlotInFiber, findNinjaItemInFiber } from '../src/adapters/fiber.ts';
import { linkName } from '../src/adapters/names.ts';

const items = JSON.parse(JSON.parse(readFileSync('tests/fixtures/planner-z7coxn0y.json', 'utf8')).data).items;
const item = items['32'];

// Mirrors the verified live shape: the slot element's fiber holds the item 2 levels up.
const slotLike = (props: object) => ({
  '__reactFiber$abc123': {
    memoizedProps: { className: 'poe2-PaperdollSlot' },
    return: { memoizedProps: { children: [] }, return: { memoizedProps: props, return: null } },
  },
});

describe('findItemInFiber', () => {
  it('finds the planner item two levels up', () => {
    expect(findItemInFiber(slotLike({ item, disabled: false }))).toEqual(item);
  });

  it('respects maxDepth', () => {
    expect(findItemInFiber(slotLike({ item }), 1)).toBeNull();
  });

  it('ignores props that are not planner items', () => {
    expect(findItemInFiber(slotLike({ item: { base: 'x' } }))).toBeNull();
  });

  it('returns null for elements without a fiber', () => {
    expect(findItemInFiber({})).toBeNull();
  });
});

const moba = JSON.parse(readFileSync('tests/fixtures/mobalytics-equipment.json', 'utf8')).variants['default-variant'];

// Mirrors the live mobalytics shape: the slot div's parent component names the slot,
// and a paperdoll component two levels further up holds every slot in `data`.
const mobaSlotLike = (data: object, slot = 'helmet') => ({
  '__reactFiber$xyz': {
    memoizedProps: { className: 'x1' },
    return: {
      memoizedProps: { slot, poeTradeUrl: 'https://www.pathofexile.com/trade2/search/…' },
      return: { memoizedProps: { className: 'x2' }, return: { memoizedProps: { row: [], data }, return: null } },
    },
  },
});

describe('findMobaSlotInFiber', () => {
  it('returns the equipment item and runes of the rendered slot', () => {
    const data = { helmet: { slug: 'x', qualityColor: 'y', equipmentItem: moba.helmet.equipmentItem, runes: null } };
    expect(findMobaSlotInFiber(mobaSlotLike(data))).toEqual({ equipmentItem: moba.helmet.equipmentItem, runes: null });
  });

  it('returns null when the slot is empty or missing', () => {
    expect(findMobaSlotInFiber(mobaSlotLike({ helmet: null }))).toBeNull();
    expect(findMobaSlotInFiber(mobaSlotLike({}, 'boots'))).toBeNull();
    expect(findMobaSlotInFiber({})).toBeNull();
  });
});

describe('linkName', () => {
  it('normalises element text into a lookup name', () => {
    expect(linkName('  Herald of\n Ice ')).toBe('Herald of Ice');
    expect(linkName("Uruk's Smelting")).toBe("Uruk's Smelting");
  });

  it('rejects text that cannot be an item name', () => {
    for (const s of ['', ' ', '1', '18 / 20', '(trigger)'.slice(0, 1), 'x'.repeat(81)]) expect(linkName(s)).toBeNull();
    expect(linkName(null)).toBeNull();
  });
});

describe('findNinjaItemInFiber', () => {
  it('returns itemData from the tile component props', () => {
    const itemData = { baseType: 'Pearl Ring', frameType: 2 };
    const tile = {
      '__reactFiber$n1': {
        memoizedProps: { href: '#' },
        return: { memoizedProps: { tooltip: {} }, return: { memoizedProps: { item: { itemSlot: 1, itemData } }, return: null } },
      },
    };
    expect(findNinjaItemInFiber(tile)).toEqual(itemData);
    expect(findNinjaItemInFiber({})).toBeNull();
  });
});

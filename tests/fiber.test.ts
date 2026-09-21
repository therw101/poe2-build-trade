import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findItemInFiber } from '../src/adapters/fiber.ts';

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

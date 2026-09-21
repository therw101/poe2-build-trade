import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildTradeItems,
  type TradeItemsResponse,
  type TradeStaticResponse,
} from '../scripts/lib/build-data-lib.ts';
import { decodeQuery, exchangeUrl } from '../src/core/encode.ts';
import { linkSearch } from '../src/core/links.ts';

const read = (p: string) => JSON.parse(readFileSync(`tests/fixtures/${p}`, 'utf8'));
const map = buildTradeItems(
  read('trade-items.json') as TradeItemsResponse,
  read('trade-static.json') as TradeStaticResponse,
  '2026-09-21T00:00:00.000Z',
);
const target = (name: string) => map.byName[name];

describe('buildTradeItems', () => {
  it('resolves names seen in the reference guide', () => {
    expect(target('Exalted Orb')).toEqual({ kind: 'exchange', id: 'exalted' });
    expect(target('Thaumaturgic Flux (Level 9)')).toEqual({ kind: 'exchange', id: 'thaumaturgic-flux-9' });
    expect(target("Craiceann's Rune of Recovery")).toEqual({ kind: 'exchange', id: 'craiceanns-rune-of-recovery' });
    expect(target('Spell Totem')).toEqual({ kind: 'type', type: 'Spell Totem' });
    expect(target('Biting Frost I')).toEqual({ kind: 'type', type: 'Biting Frost I' });
    expect(target('Darkness Enthroned')).toEqual({ kind: 'unique', name: 'Darkness Enthroned', type: 'Fine Belt' });
    expect(target('Solar Amulet')).toEqual({ kind: 'base', type: 'Solar Amulet' });
  });

  it('prefers bulk exchange for items listed in both places', () => {
    expect(target("Rakiata's Flow")).toEqual({ kind: 'exchange', id: 'rakiatas-flow' });
  });

  it('leaves unknown names unresolved', () => {
    expect(target('Purity of Fire')).toBeUndefined();
    expect(target('New Item')).toBeUndefined();
  });
});

describe('linkSearch', () => {
  it('uses bulk exchange for currency with any payment currency', () => {
    expect(linkSearch({ kind: 'exchange', id: 'gcp' }, 'available')).toEqual({
      mode: 'exchange',
      query: { status: { option: 'online' }, want: ['gcp'], have: [] },
    });
    expect(linkSearch({ kind: 'exchange', id: 'gcp' }, 'any').query.status.option).toBe('any');
  });

  it('searches gems by type, uniques by name, bases without uniques', () => {
    expect(linkSearch({ kind: 'type', type: 'Spell Totem' }, 'online')).toEqual({
      mode: 'search',
      query: { status: { option: 'online' }, type: 'Spell Totem', stats: [{ type: 'and', filters: [] }] },
    });
    expect(linkSearch({ kind: 'unique', name: 'Darkness Enthroned', type: 'Fine Belt' }, 'available').query).toMatchObject({
      name: 'Darkness Enthroned',
      type: 'Fine Belt',
    });
    expect(linkSearch({ kind: 'base', type: 'Solar Amulet' }, 'available').query).toMatchObject({
      type: 'Solar Amulet',
      filters: { type_filters: { filters: { rarity: { option: 'nonunique' } } } },
    });
  });
});

describe('exchangeUrl', () => {
  it('builds a trade2 exchange URL verified on the live site', async () => {
    const q = { status: { option: 'online' as const }, want: ['gcp'], have: [] };
    const url = await exchangeUrl('Runes of Aldur', q);
    expect(url.startsWith('https://www.pathofexile.com/trade2/exchange/poe2/Runes%20of%20Aldur/')).toBe(true);
    expect(await decodeQuery(url.split('/').pop()!)).toEqual(q);
  });
});

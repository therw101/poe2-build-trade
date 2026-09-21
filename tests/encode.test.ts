import { describe, expect, it } from 'vitest';
import { decodeQuery, encodeQuery, tradeUrl } from '../src/core/encode.ts';
import type { TradeQuery } from '../src/core/types.ts';

// Payload from a real trade2 URL shared by the user.
const EXAMPLE_PAYLOAD =
  'H4sIAAAAAAAAE6tWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1QHLFytZRVcrlVQWpIJk81KUdJTSMnNKUotAErG1sbUA2ikBQEcAAAA';

// Query verified against the live trade site in the spike.
const SPIKE_QUERY: TradeQuery = {
  status: { option: 'available' },
  type: 'Attuned Wand',
  stats: [
    {
      type: 'count',
      value: { min: 2 },
      filters: [
        { id: 'explicit.stat_2974417149', value: { min: 51 } },
        { id: 'explicit.stat_2891184298', value: { min: 11 } },
        { id: 'explicit.stat_124131830', value: { min: 2, max: 5 } },
      ],
    },
  ],
  filters: {
    type_filters: { filters: { category: { option: 'weapon.wand' }, rarity: { option: 'nonunique' } } },
    equipment_filters: { filters: { rune_sockets: { min: 1 } } },
  },
};

describe('encode', () => {
  it('decodes the real example payload', async () => {
    expect(await decodeQuery(EXAMPLE_PAYLOAD)).toEqual({
      status: { option: 'available' },
      stats: [{ type: 'and', filters: [] }],
    });
  });

  it('round-trips a full query', async () => {
    expect(await decodeQuery(await encodeQuery(SPIKE_QUERY))).toEqual(SPIKE_QUERY);
  });

  it('produces unpadded base64url', async () => {
    expect(await encodeQuery(SPIKE_QUERY)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('builds a trade2 URL with an encoded league', async () => {
    const url = await tradeUrl('Runes of Aldur', SPIKE_QUERY);
    expect(url.startsWith('https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/')).toBe(true);
    const payload = url.split('/').pop()!;
    expect(await decodeQuery(payload)).toEqual(SPIKE_QUERY);
  });
});

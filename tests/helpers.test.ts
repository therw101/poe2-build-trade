import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareVersions, pickDefaultLeague, type League } from '../src/core/leagues.ts';
import { isPlannerItem, isStatMap } from '../src/core/validate.ts';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const leagues: League[] = read('tests/fixtures/trade-leagues.json').result;
const items = JSON.parse(read('tests/fixtures/planner-z7coxn0y.json').data).items;

describe('pickDefaultLeague', () => {
  it('picks the first current softcore league', () => {
    expect(pickDefaultLeague(leagues)).toBe('Forbidden Rites');
  });

  it('falls back to Standard', () => {
    const permanent = leagues.filter((l) => l.id === 'Standard' || l.id === 'Hardcore');
    expect(pickDefaultLeague(permanent)).toBe('Standard');
    expect(pickDefaultLeague([])).toBe('Standard');
  });
});

describe('compareVersions', () => {
  it('orders dotted versions', () => {
    expect(compareVersions('v0.2.0', '0.1.9')).toBe(1);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('0.1', '0.1.1')).toBe(-1);
  });
});

describe('validation', () => {
  it('accepts real planner items and rejects other shapes', () => {
    expect(isPlannerItem(items['32'])).toBe(true);
    expect(isPlannerItem({})).toBe(false);
    expect(isPlannerItem({ base: 1 })).toBe(false);
    expect(isPlannerItem({ ...items['32'], rarity: 'legendary' })).toBe(false);
  });

  it('accepts the bundled stat map', () => {
    expect(isStatMap(read('public/data/stat-map.json'))).toBe(true);
    expect(isStatMap({ entries: 'x' })).toBe(false);
  });
});

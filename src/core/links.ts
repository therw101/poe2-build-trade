import type { ExchangeQuery, LinkTarget, TradeQuery, TradeStatus } from './types.ts';

export type LinkSearch =
  | { mode: 'search'; query: TradeQuery }
  | { mode: 'exchange'; query: ExchangeQuery };

/** One-click search for an inline guide link. Bulk exchange has no "available" status. */
export function linkSearch(target: LinkTarget, status: TradeStatus): LinkSearch {
  if (target.kind === 'exchange') {
    return {
      mode: 'exchange',
      query: { status: { option: status === 'any' ? 'any' : 'online' }, want: [target.id], have: [] },
    };
  }
  const query: TradeQuery = { status: { option: status }, stats: [{ type: 'and', filters: [] }] };
  if (target.kind === 'unique') query.name = target.name;
  query.type = target.type;
  if (target.kind === 'base') {
    query.filters = { type_filters: { filters: { rarity: { option: 'nonunique' } } } };
  }
  return { mode: 'search', query };
}

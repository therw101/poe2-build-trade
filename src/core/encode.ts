import { TRADE_SEARCH_URL } from '../config.ts';
import type { TradeQuery } from './types.ts';

async function pipeThrough(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Encodes a trade query the way trade2 URLs carry it: base64url(gzip(JSON)), unpadded. */
export async function encodeQuery(q: TradeQuery): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(q));
  return toBase64Url(await pipeThrough(json, new CompressionStream('gzip')));
}

export async function decodeQuery(payload: string): Promise<unknown> {
  const bytes = await pipeThrough(fromBase64Url(payload), new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function tradeUrl(league: string, q: TradeQuery): Promise<string> {
  return `${TRADE_SEARCH_URL}${encodeURIComponent(league)}/${await encodeQuery(q)}`;
}

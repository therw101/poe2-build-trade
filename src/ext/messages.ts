import { browser } from 'wxt/browser';
import type { ItemModel, PlannerItem } from '../core/types.ts';

export type Request =
  | { type: 'plannerItem'; profileId: string; itemId: string }
  | { type: 'toModel'; item: PlannerItem }
  | { type: 'context' };

export type ErrorCode = 'network' | 'format' | 'notFound';
export type Response<T> = { ok: true; data: T } | { ok: false; error: ErrorCode };

export interface Context {
  league: string;
  /** True once, when the saved league ended and was replaced by the default. */
  leagueChanged: boolean;
  update: { version: string; url: string } | null;
  dataGeneratedAt: string;
}

export interface ResponseFor {
  plannerItem: PlannerItem;
  toModel: ItemModel;
  context: Context;
}

export async function sendMessage<R extends Request>(req: R): Promise<Response<ResponseFor[R['type']]>> {
  try {
    return await browser.runtime.sendMessage(req);
  } catch (err) {
    console.error('[b2t] message failed', req.type, err);
    return { ok: false, error: 'network' };
  }
}

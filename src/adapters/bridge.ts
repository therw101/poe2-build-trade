/** DOM event protocol between the isolated content script and the MAIN-world item reader. */
export const READ_EVENT = 'b2t:read-item';
export const ITEM_EVENT = 'b2t:item';
export const KEY_ATTR = 'data-b2t-key';

/** Detail of ITEM_EVENT, sent as a JSON string so it crosses worlds intact. */
export interface ItemReply {
  key: string;
  item: unknown;
}

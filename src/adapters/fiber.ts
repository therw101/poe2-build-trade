import type { PlannerItem } from '../core/types.ts';
import { isPlannerItem } from '../core/validate.ts';

interface FiberLike {
  memoizedProps?: Record<string, unknown> | null;
  return?: FiberLike | null;
}

/**
 * Reads the planner item that React rendered into a maxroll paperdoll slot.
 * Must run in the page's MAIN world, where React's `__reactFiber$*` expando is visible.
 */
function fiberOf(el: object): FiberLike | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  return key ? ((el as Record<string, unknown>)[key] as FiberLike | null) : null;
}

export function findItemInFiber(el: object, maxDepth = 6): PlannerItem | null {
  let fiber: FiberLike | null | undefined = fiberOf(el);
  for (let depth = 0; fiber && depth <= maxDepth; depth++, fiber = fiber.return) {
    const item = fiber.memoizedProps?.item;
    if (isPlannerItem(item)) return item;
  }
  return null;
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/**
 * Reads the item in a mobalytics paperdoll slot: the slot's component names the slot
 * (`slot: "helmet"`), and a paperdoll ancestor holds every slot in `data`. Jewel slots pass
 * the item as an `item` prop instead. MAIN world only.
 * Returns the raw `{ equipmentItem, runes }`; the background validates it.
 */
export function findMobaSlotInFiber(el: object, maxDepth = 8): unknown {
  let slot: string | null = null;
  let fiber: FiberLike | null | undefined = fiberOf(el);
  for (let depth = 0; fiber && depth <= maxDepth; depth++, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (!props) continue;
    if (slot === null) {
      // Jewels render their item directly as a prop.
      if (isObject(props.item) && 'poe2TradeRequest' in props.item) return { equipmentItem: props.item, runes: null };
      if (typeof props.slot === 'string') slot = props.slot;
      continue;
    }
    if (!isObject(props.data)) continue;
    const entry = props.data[slot];
    return isObject(entry) && isObject(entry.equipmentItem)
      ? { equipmentItem: entry.equipmentItem, runes: entry.runes ?? null }
      : null;
  }
  return null;
}

/** Reads the item behind a poe.ninja item tile (`item.itemData` a few levels up). MAIN world only. */
export function findNinjaItemInFiber(el: object, maxDepth = 4): unknown {
  let fiber: FiberLike | null | undefined = fiberOf(el);
  for (let depth = 0; fiber && depth <= maxDepth; depth++, fiber = fiber.return) {
    const item = fiber.memoizedProps?.item;
    if (isObject(item) && isObject(item.itemData)) return item.itemData;
  }
  return null;
}

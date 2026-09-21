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
export function findItemInFiber(el: object, maxDepth = 6): PlannerItem | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return null;
  let fiber = (el as Record<string, unknown>)[key] as FiberLike | null | undefined;
  for (let depth = 0; fiber && depth <= maxDepth; depth++, fiber = fiber.return) {
    const item = fiber.memoizedProps?.item;
    if (isPlannerItem(item)) return item;
  }
  return null;
}

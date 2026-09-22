import { classForCategory, classLabel } from './categories.ts';
import {
  STAT_KINDS,
  type ItemModel,
  type MobaSlot,
  type ModRow,
  type RowKind,
  type StatKind,
  type TradeItemsMap,
  type TradeStatText,
} from './types.ts';

interface GuideFilter {
  id: string;
  value?: { min?: number; max?: number };
  disabled?: boolean;
}

interface GuideQuery {
  name?: string;
  type?: string;
  stats?: { filters?: GuideFilter[] }[];
  filters?: { type_filters?: { filters?: { category?: { option?: string } } } };
}

/** Display template for a trade stat id, or null when trade no longer lists it. */
export function statTemplate(statText: TradeStatText, id: string): string | null {
  return statText.text[id] ?? statText.text[id.slice(id.indexOf('.') + 1)] ?? null;
}

/** The inner query of mobalytics' `poe2TradeRequest.query` JSON string; null when unreadable. */
function guideQuery(slot: MobaSlot): GuideQuery | null {
  const raw = slot.equipmentItem.poe2TradeRequest?.query;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const q = (parsed as { query?: unknown } | null)?.query;
    return typeof q === 'object' && q !== null ? (q as GuideQuery) : null;
  } catch {
    return null;
  }
}

function rowKind(id: string): RowKind {
  const prefix = id.slice(0, id.indexOf('.'));
  if (prefix === 'pseudo') return 'pseudo';
  return STAT_KINDS.includes(prefix as StatKind) ? (prefix as StatKind) : 'explicit';
}

const bound = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function guideRow(f: GuideFilter, statText: TradeStatText): ModRow {
  const min = bound(f.value?.min);
  const max = bound(f.value?.max);
  const template = statTemplate(statText, f.id);
  return {
    kind: rowKind(f.id),
    // The guide gives a threshold, not a rolled value, so the template keeps its "#".
    text: template ?? f.id,
    value: min ?? max ?? 0,
    numeric: template ? template.includes('#') : min !== null || max !== null,
    tradeId: f.id,
    preset: { min, max },
  };
}

/**
 * Converts a mobalytics paperdoll slot to the shared item model. Guide items are
 * build targets, not rolled items: rares carry the guide's trade filters as preset rows.
 */
export function mobaToModel(slot: MobaSlot, statText: TradeStatText, tradeItems: TradeItemsMap): ItemModel {
  const item = slot.equipmentItem;
  const q = guideQuery(slot);
  const category = q?.filters?.type_filters?.filters?.category?.option ?? null;
  const itemClass = classForCategory(category);
  const base = { itemClass, category, sockets: slot.runes?.length ?? 0 };

  if (item.isUnique) {
    // The guide's own query has the trade name; the display name may carry a variant.
    const name = q?.name ?? (item.name ?? '').replace(/\s*\([^)]*\)$/, '');
    const target = tradeItems.byName[name];
    return { ...base, rarity: 'unique', name, baseName: target?.kind === 'unique' ? target.type : null, mods: [] };
  }

  const baseName = item.name ?? null;
  const name = baseName ?? (itemClass ? classLabel(itemClass) : 'Item');
  const filters = (q?.stats ?? [])
    .flatMap((g) => g.filters ?? [])
    .filter((f): f is GuideFilter => typeof f?.id === 'string' && !f.disabled);
  const typeName = q?.type ?? baseName;
  if (!filters.length && typeName) return { ...base, rarity: 'normal', name, baseName: typeName, mods: [] };

  // Rare, or a filterless item with no known base (searched by category from the popup).
  return { ...base, rarity: 'rare', name, baseName, mods: filters.map((f) => guideRow(f, statText)) };
}

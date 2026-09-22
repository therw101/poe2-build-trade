import type { StatMap, StatMapEntry } from './types.ts';

const NUMBER = /[+-]?\d+(?:\.\d+)?/g;
const MARKUP = /\[([^\]|]*\|)?([^\]]*)\]/g;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Display text without poe.ninja's "[Tag|Shown]" markup. */
export const plainText = (s: string) => s.replace(MARKUP, '$2').replace(/\s+/g, ' ').trim();

/** Mod line or template → lookup key: markup stripped, numbers and "+#" as "#", lowercase. */
export function textKey(s: string): string {
  return plainText(s).replace(NUMBER, '#').replace(/\+#/g, '#').toLowerCase();
}

interface Candidate {
  entry: StatMapEntry;
  /** Matched the negative template ("reduced"), so the value is negated. */
  neg: boolean;
  /** For option stats ("Allocates #"), the option value the name stands for. */
  option?: number;
}

/** Stat map templates (and option names) by text key, for reading mods from display text. */
export type TextIndex = Map<string, Candidate[]>;

export function indexStatTexts(m: StatMap): TextIndex {
  const index: TextIndex = new Map();
  const add = (text: string, c: Candidate) => {
    const key = textKey(text);
    const list = index.get(key);
    if (list) list.push(c);
    else index.set(key, [c]);
  };
  for (const entry of m.entries) {
    if (entry.option) {
      for (const [value, name] of Object.entries(m.options?.[entry.option] ?? {})) {
        add(entry.text.replace(/\+?#/, name), { entry, neg: false, option: Number(value) });
      }
      continue;
    }
    add(entry.text, { entry, neg: false });
    if (entry.negText) add(entry.negText, { entry, neg: true });
  }
  return index;
}

export interface TextMatch {
  entry: StatMapEntry;
  /** Mean of the numbers in the line (trade compares "Adds # to #" by its average). */
  value: number;
  numeric: boolean;
  option?: number;
}

const isLocal = (e: StatMapEntry) => e.ids.some((id) => id.startsWith('local_'));

/**
 * Matches one displayed mod line to a stat map entry. Local and global stats share their
 * wording ("+# to maximum Energy Shield"), so `preferLocal` picks for weapons and armour.
 */
export function matchModText(index: TextIndex, line: string, preferLocal: boolean): TextMatch | null {
  const candidates = index.get(textKey(line));
  if (!candidates?.length) return null;
  const pick = candidates.find((c) => isLocal(c.entry) === preferLocal) ?? candidates[0]!;
  if (pick.option !== undefined) return { entry: pick.entry, value: pick.option, numeric: false, option: pick.option };
  const numbers = (plainText(line).match(NUMBER) ?? []).map(Number);
  const mean = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  return { entry: pick.entry, value: round2(pick.neg ? -Math.abs(mean) : mean), numeric: numbers.length > 0 };
}

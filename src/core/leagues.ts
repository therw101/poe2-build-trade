export interface League {
  id: string;
  realm?: string;
  text: string;
}

const NOT_DEFAULT = /^(HC\b|Hardcore|Standard)|SSF|Ruthless/i;

/** First current softcore trade league, e.g. "Forbidden Rites"; "Standard" when none. */
export function pickDefaultLeague(leagues: League[]): string {
  const candidate = leagues.find((l) => (l.realm ?? 'poe2') === 'poe2' && !NOT_DEFAULT.test(l.id));
  return candidate?.id ?? 'Standard';
}

/** Compares dotted numeric versions; a leading "v" is ignored. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

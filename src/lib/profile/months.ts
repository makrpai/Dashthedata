/** Month and quarter vocabularies shared by date parsing and unpivot detection (8.3, 9.4.4). */
const FI_FULL = ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu'];
const FI_STEM = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];
const FI_ABBR = ['tam', 'hel', 'maa', 'huh', 'tou', 'kes', 'hei', 'elo', 'syy', 'lok', 'mar', 'jou'];
const EN_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const EN_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Token → month number for one language. `mar` means November in Finnish and March in English. */
export function monthTable(locale: 'fi' | 'en'): Map<string, number> {
  const map = new Map<string, number>();
  const add = (list: string[]) => list.forEach((w, i) => map.set(w, i + 1));
  if (locale === 'fi') {
    add(EN_FULL);
    add(EN_ABBR);
    add(FI_ABBR);
    add(FI_STEM);
    add(FI_FULL);
  } else {
    add(FI_FULL);
    add(FI_STEM);
    add(FI_ABBR);
    add(EN_FULL);
    add(EN_ABBR);
  }
  map.set('sept', 9);
  return map;
}

export function monthFromName(token: string, locale: 'fi' | 'en'): number | null {
  const t = token.toLowerCase().replace(/\.$/, '');
  return monthTable(locale).get(t) ?? null;
}

/** Guesses the vocabulary of a list of month tokens: Finnish if any token is Finnish-only. */
export function guessMonthLocale(tokens: string[], fallback: 'fi' | 'en'): 'fi' | 'en' {
  const fiOnly = new Set([...FI_FULL, ...FI_STEM, ...FI_ABBR].filter((w) => !EN_FULL.includes(w) && !EN_ABBR.includes(w)));
  const enOnly = new Set([...EN_FULL, ...EN_ABBR].filter((w) => !FI_FULL.includes(w) && !FI_STEM.includes(w) && !FI_ABBR.includes(w)));
  let fi = 0;
  let en = 0;
  for (const tok of tokens) {
    const t = tok.toLowerCase().replace(/\.$/, '');
    if (fiOnly.has(t)) fi++;
    if (enOnly.has(t)) en++;
  }
  if (fi > en) return 'fi';
  if (en > fi) return 'en';
  return fallback;
}

/** SQL CASE turning a lower-cased month token into its number. */
export function monthCaseSql(expr: string, locale: 'fi' | 'en'): string {
  const entries = [...monthTable(locale).entries()];
  return `(CASE ${expr} ${entries.map(([w, n]) => `WHEN '${w}' THEN ${n}`).join(' ')} END)`;
}

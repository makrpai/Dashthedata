/** Safe, readable SQL name: ä→a, ö→o, å→a, spaces → _, lower case (9.3 promoteHeader). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/** Unique SQL names: empty → column_<n>, duplicates get _2, _3; reserved names avoided. */
export function uniqueSqlNames(names: string[], taken: Iterable<string> = []): string[] {
  const used = new Set<string>([...taken, '__row']);
  return names.map((name, i) => {
    let base = slugify(name) || `column_${i + 1}`;
    if (/^\d/.test(base)) base = `c_${base}`;
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) candidate = `${base}_${n++}`;
    used.add(candidate);
    return candidate;
  });
}

/** A new SQL name that does not clash with existing columns. */
export function freshSqlName(name: string, columns: Array<{ sqlName: string }>): string {
  return uniqueSqlNames([name], columns.map((c) => c.sqlName))[0];
}

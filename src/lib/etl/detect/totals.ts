import type { DetectContext, Proposal } from '../types';
import { TOTAL_RE, fetchRows, isEmpty, isNumberOrDate, textual, toNumber } from './common';

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 0.005 + 1e-9;

/** 5. Total rows (keyword or sum) and a "Total" column (9.4.2). */
export async function detectTotals(ctx: DetectContext): Promise<Proposal[]> {
  if (ctx.rowCount > 20000 || !ctx.columns.length) return [];
  const { rows, rowNumbers } = await fetchRows(ctx);
  if (rows.length < 2) return [];
  const proposals: Proposal[] = [];

  const numericCols = ctx.columns
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => {
      if (!textual(c)) return c.type === 'integer' || c.type === 'decimal';
      const vals = rows.map((r) => r[i]).filter((v): v is string => !isEmpty(v));
      return vals.length > 0 && vals.filter((v) => toNumber(v, ctx.dataLocale) !== null).length / vals.length >= 0.8;
    });

  const auto: number[] = [];
  const suggested: number[] = [];
  let label: string | undefined;
  rows.forEach((r, idx) => {
    const firstText = r.find((v): v is string => v !== null && !isEmpty(v) && !isNumberOrDate(v));
    if (!firstText || !TOTAL_RE.test(firstText.trim())) return;
    label = label ?? firstText.trim();
    if (idx >= rows.length - 3) auto.push(rowNumbers[idx]);
    else suggested.push(rowNumbers[idx]);
  });

  // Without a keyword: the last row equals the sum of the rows above in every numeric column.
  const lastIdx = rows.length - 1;
  if (!auto.includes(rowNumbers[lastIdx]) && numericCols.length >= 1 && rows.length >= 3) {
    const sums = numericCols.map(({ i }) =>
      rows.slice(0, lastIdx).reduce((s, r) => s + (toNumber(r[i], ctx.dataLocale) ?? 0), 0),
    );
    const last = numericCols.map(({ i }) => toNumber(rows[lastIdx][i], ctx.dataLocale));
    const nonEmpty = last.filter((v) => v !== null).length;
    if (nonEmpty >= 1 && last.every((v, k) => v === null || close(v, sums[k])) && sums.some((s) => s !== 0)) {
      proposals.push({ kind: 'removeTotalRows', params: { rowNumbers: [rowNumbers[lastIdx]], reason: 'sum' }, confidence: 0.85, threshold: 0.8 });
    }
  }
  if (auto.length) proposals.unshift({ kind: 'removeTotalRows', params: { rowNumbers: auto, reason: 'keyword', label }, confidence: 0.9, threshold: 0.8 });
  if (suggested.length) proposals.push({ kind: 'removeTotalRows', params: { rowNumbers: suggested, reason: 'keyword', label }, confidence: 0.7, threshold: 0.8 });

  // A "Total" column whose values equal the sum of the other numeric columns in the row.
  const totalRows = new Set([...auto, ...suggested]);
  for (const { c, i } of numericCols) {
    if (!TOTAL_RE.test(c.displayName.trim())) continue;
    const others = numericCols.filter((o) => o.i !== i);
    if (!others.length) continue;
    let checked = 0;
    let matched = 0;
    rows.forEach((r, idx) => {
      if (totalRows.has(rowNumbers[idx])) return;
      const total = toNumber(r[i], ctx.dataLocale);
      if (total === null) return;
      checked++;
      const sum = others.reduce((s, o) => s + (toNumber(r[o.i], ctx.dataLocale) ?? 0), 0);
      if (close(total, sum)) matched++;
    });
    if (checked > 0 && matched / checked >= 0.9) {
      proposals.push({ kind: 'dropColumn', params: { columnId: c.id, name: c.displayName, reason: 'total' }, confidence: 0.85, threshold: 0.85 });
    }
  }
  return proposals;
}

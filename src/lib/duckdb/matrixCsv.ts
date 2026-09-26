import { quoteIdent, sqlLiteral } from './sql';

/**
 * Serialises a string matrix as CSV where every non-null field is quoted and NULL is an empty
 * unquoted field. Used to load matrices without building Arrow tables in JS (Arrow's builders
 * rely on `new Function`, which the CSP forbids).
 */
export function matrixToCsv(rows: Array<Array<string | null>>, width: number): string {
  const out: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const fields = new Array<string>(width + 1);
    fields[0] = String(r + 1);
    for (let c = 0; c < width; c++) {
      const v = row[c];
      fields[c + 1] = v === null || v === undefined ? '' : `"${v.replace(/"/g, '""')}"`;
    }
    out.push(fields.join(','));
  }
  return out.join('\n') + '\n';
}

/** read_csv call that reads matrixToCsv output back with exact VARCHAR columns. */
export function matrixCsvSelect(virtualName: string, columns: string[]): string {
  const cols = [`${sqlLiteral('__row')}: 'BIGINT'`, ...columns.map((c) => `${sqlLiteral(c)}: 'VARCHAR'`)].join(', ');
  return (
    `SELECT * FROM read_csv(${sqlLiteral(virtualName)}, delim = ',', quote = '"', escape = '"', header = false, ` +
    `auto_detect = false, columns = {${cols}}, allow_quoted_nulls = false)`
  );
}

export function createFromMatrixSql(table: string, virtualName: string, columns: string[]): string {
  return `CREATE TABLE ${quoteIdent(table)} AS ${matrixCsvSelect(virtualName, columns)} ORDER BY "__row"`;
}

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { NodeRunner } from '../../helpers/nodeRunner';
import { processFixture, summary } from '../../helpers/fixtures';

/**
 * Every fixture goes through the whole automatic ETL and is compared with
 * tests/fixtures/<name>.expected.json (20.2). UPDATE_EXPECTED=1 rewrites the files.
 */
const FIXTURES: Array<{ file: string; dataLocale?: 'fi' | 'en'; sheet?: string }> = [
  { file: 'fi-sales-messy.xlsx', sheet: 'Myynti 2025' },
  { file: 'header-offset.csv' },
  { file: 'win1252-semicolon.csv' },
  { file: 'us-format.csv', dataLocale: 'en' },
  { file: 'ambiguous-dates.csv' },
  { file: 'leading-zeros.csv' },
  { file: 'wide-quarters.xlsx' },
  { file: 'nested.json' },
  { file: 'columnar.json' },
  { file: 'union-a.csv' },
  { file: 'union-b.csv' },
  { file: 'orders.csv' },
  { file: 'customers.csv' },
  { file: 'no-header.csv' },
  { file: 'totals-false-positive.csv' },
];

let db: NodeRunner;
beforeAll(async () => {
  db = await NodeRunner.create();
});

describe('fixtures through the automatic ETL', () => {
  it.each(FIXTURES)('$file', async ({ file, dataLocale, sheet }) => {
    const { dataset } = await processFixture(db, file, { dataLocale, sheet });
    const s = summary(dataset);
    const cols = dataset.columns.map((c) => c.sqlName);
    const checkRows = await db.query(
      `SELECT ${cols.map((c) => `CAST("${c}" AS VARCHAR) AS "${c}"`).join(', ')} FROM ${dataset.outputTable} ORDER BY __row LIMIT 3`,
    );
    const actual = {
      columns: s.columns,
      rowCount: s.rowCount,
      steps: s.applied,
      suggestions: s.suggested,
      checkRows,
    };
    const path = join(__dirname, '../../fixtures', `${file}.expected.json`);
    if (process.env.UPDATE_EXPECTED || !existsSync(path)) writeFileSync(path, JSON.stringify(actual, null, 2) + '\n');
    expect(s.errors).toEqual([]);
    expect(actual).toEqual(JSON.parse(readFileSync(path, 'utf8')));
  });
});

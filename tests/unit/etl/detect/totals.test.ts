import { beforeAll, describe, expect, it } from 'vitest';
import { detectFillDown } from '@/lib/etl/detect/fillDown';
import { detectTotals } from '@/lib/etl/detect/totals';
import type { ColumnRef, DetectContext } from '@/lib/etl/types';
import { NodeRunner } from '../../../helpers/nodeRunner';

let db: NodeRunner;
beforeAll(async () => {
  db = await NodeRunner.create();
});

async function ctxFor(name: string, header: string[], rows: Array<Array<string | null>>, merged: string[] = []): Promise<DetectContext> {
  await db.createStringTable(name, header.map((_, i) => `c${i}`), rows);
  const columns: ColumnRef[] = header.map((h, i) => ({ id: `col_${i}`, sqlName: `c${i}`, displayName: h, type: 'varchar' }));
  return {
    runner: db,
    from: `"${name}"`,
    columns,
    rowCount: rows.length,
    locale: 'fi',
    dataLocale: 'fi',
    typedAtSource: false,
    mergedColumnIds: merged,
    datasetName: name,
    notes: [],
    canonicalNumbers: false,
  };
}

describe('total rows and columns (9.4.2)', () => {
  it('keyword in the last rows is automatic', async () => {
    const ctx = await ctxFor('t1', ['Tuote', 'Summa'], [['A', '1'], ['B', '2'], ['Yhteensä', '3']]);
    const p = await detectTotals(ctx);
    expect(p[0]).toMatchObject({ kind: 'removeTotalRows', confidence: 0.9, params: { rowNumbers: [3], label: 'Yhteensä' } });
  });
  it('keyword in the middle is only a suggestion', async () => {
    const rows = [['A', '1'], ['Välisumma', '1'], ['B', '2'], ['C', '3'], ['D', '4'], ['E', '5']];
    const p = await detectTotals(await ctxFor('t2', ['Tuote', 'Summa'], rows));
    expect(p.find((x) => x.kind === 'removeTotalRows')).toMatchObject({ confidence: 0.7 });
  });
  it('a sum row without a keyword', async () => {
    const p = await detectTotals(await ctxFor('t3', ['Tuote', 'Summa'], [['A', '10'], ['B', '20'], [null, '30']]));
    expect(p[0]).toMatchObject({ kind: 'removeTotalRows', confidence: 0.85, params: { reason: 'sum' } });
  });
  it('"Yhteensä-paketti" is not a total row', async () => {
    const p = await detectTotals(await ctxFor('t4', ['Tuote', 'Määrä'], [['Yhteensä-paketti', '3'], ['Kengät', '2'], ['Takki', '1']]));
    expect(p).toEqual([]);
  });
  it('finds a Total column', async () => {
    const p = await detectTotals(await ctxFor('t5', ['Tuote', 'Q1', 'Q2', 'Yhteensä'], [['A', '1', '2', '3'], ['B', '5', '5', '10']]));
    expect(p.find((x) => x.kind === 'dropColumn')).toMatchObject({ params: { columnId: 'col_3', reason: 'total' }, confidence: 0.85 });
  });
});

describe('fill down (9.4.3)', () => {
  const rows = [
    ['Helsinki', 'Kengät', '1'],
    [null, 'Takit', '2'],
    [null, 'Pipot', '3'],
    ['Oulu', 'Kengät', '4'],
    [null, 'Takit', '5'],
  ];
  it('detects the merged-cell pattern', async () => {
    const p = await detectFillDown(await ctxFor('f1', ['Alue', 'Tuote', 'Kpl'], rows));
    expect(p[0]).toMatchObject({ kind: 'fillDown', params: { columnIds: ['col_0'] }, confidence: 0.8 });
  });
  it('merge hints raise confidence', async () => {
    const p = await detectFillDown(await ctxFor('f2', ['Alue', 'Tuote', 'Kpl'], rows, ['col_0']));
    expect(p[0].confidence).toBe(0.95);
  });
  it('ignores columns that start empty', async () => {
    const p = await detectFillDown(await ctxFor('f3', ['Alue', 'Tuote', 'Kpl'], [[null, 'a', '1'], ['X', 'b', '2'], [null, 'c', '3']]));
    expect(p).toEqual([]);
  });
});

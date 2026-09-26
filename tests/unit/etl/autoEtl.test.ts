import { beforeAll, describe, expect, it } from 'vitest';
import { NodeRunner } from '../../helpers/nodeRunner';
import { processFixture, summary } from '../../helpers/fixtures';

let db: NodeRunner;
beforeAll(async () => {
  db = await NodeRunner.create();
});

describe('automatic ETL on the messy Finnish sales report (phase 3 acceptance)', () => {
  it('cleans to long format: Alue, Tuoteryhmä, Kuukausi, Myynti × 288 rows', async () => {
    const { dataset } = await processFixture(db, 'fi-sales-messy.xlsx', { sheet: 'Myynti 2025' });
    const s = summary(dataset);
    expect(s.errors).toEqual([]);
    expect(s.rowCount).toBe(288);
    expect(dataset.columns.map((c) => [c.displayName, c.type])).toEqual([
      ['Alue', 'text'],
      ['Tuoteryhmä', 'text'],
      ['Kuukausi', 'date'],
      ['Myynti', 'decimal'],
    ]);
    for (const kind of ['dropEmptyColumns', 'skipRows', 'promoteHeader', 'trimWhitespace', 'removeTotalRows', 'dropColumn', 'fillDown', 'unpivot', 'castTypes', 'standardizeCategories']) {
      expect(s.applied).toContain(kind);
    }
    expect(dataset.notes?.[0]).toContain('Myyntiraportti 2025');
    const alue = dataset.columns.find((c) => c.displayName === 'Alue')!;
    expect(alue.role).toBe('dimension');
    expect(alue.stats.distinct).toBe(6);
    expect(dataset.columns.find((c) => c.displayName === 'Myynti')!.role).toBe('measure');
    expect(dataset.columns.find((c) => c.displayName === 'Kuukausi')!.role).toBe('time');
    const rows = await db.query(`SELECT alue, tuoteryhma, CAST(kuukausi AS VARCHAR) AS k, myynti FROM ${dataset.outputTable} ORDER BY __row LIMIT 2`);
    expect(rows[0]).toMatchObject({ alue: 'Helsinki', tuoteryhma: 'Kengät', k: '2025-01-01' });
    expect(typeof rows[0].myynti).toBe('number');
    const [turku] = await db.query(`SELECT count(DISTINCT alue) AS n FROM ${dataset.outputTable} WHERE lower(alue) = 'turku'`);
    expect(turku.n).toBe(1);
    const [nulls] = await db.query(`SELECT count(*) AS n FROM ${dataset.outputTable} WHERE myynti IS NULL`);
    expect(nulls.n).toBe(2);
    // Effects are measured.
    const header = dataset.pipeline.find((st) => st.kind === 'promoteHeader')!;
    expect(header.effect).toBeDefined();
    expect(dataset.pipeline.find((st) => st.kind === 'unpivot')!.effect).toMatchObject({ rowsBefore: 24, rowsAfter: 288 });
  });

  it('customer sheet: ids with leading zeros, dates, booleans and a duplicate suggestion', async () => {
    const { dataset } = await processFixture(db, 'fi-sales-messy.xlsx', { sheet: 'Asiakkaat' });
    const s = summary(dataset);
    expect(s.errors).toEqual([]);
    const byName = Object.fromEntries(dataset.columns.map((c) => [c.displayName, c]));
    expect(byName.Asiakasnumero.type).toBe('text');
    expect(byName.Asiakasnumero.role).not.toBe('measure');
    expect(byName.Asiakkaaksi.type).toBe('date');
    expect(byName.Aktiivinen.type).toBe('boolean');
    expect(byName['Vuosimyynti (€)'].type).toBe('decimal');
    expect(byName.Segmentti.role).toBe('dimension');
    expect(s.suggested).toContain('dedupe');
    expect(dataset.rowCount).toBe(403);
  });
});

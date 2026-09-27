import { quoteIdent } from '@/lib/duckdb/sql';
import type { QueryRunner } from '@/lib/duckdb/types';
import { processFixture } from '../../helpers/fixtures';
import { NodeRunner } from '../../helpers/nodeRunner';
import { alignUnion, suggestUnions, unionSelectSql } from '@/lib/model/union';
import { detectRelationships, relationshipScore } from '@/lib/model/relationships';
import { describe, expect, it } from 'vitest';

describe('model (phase 7)', () => {
  it('scores relationships with the published weights', () => {
    expect(relationshipScore(1, 1, 1)).toBe(1);
    expect(relationshipScore(1, 1, 0)).toBeCloseTo(0.8);
  });

  it('suggests a union of union-a and union-b and stacks their rows', async () => {
    const db = await NodeRunner.create();
    const a = await processFixture(db, 'union-a.csv');
    const b = await processFixture(db, 'union-b.csv');
    const suggestions = suggestUnions([a.dataset, b.dataset]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].score).toBe(1);
    const columns = alignUnion([a.dataset, b.dataset]);
    expect(columns.map((c) => c.displayName).sort()).toEqual(['Hinta', 'Määrä', 'Tuote']);
    await db.exec(`CREATE VIEW stacked AS ${unionSelectSql([a.dataset, b.dataset], columns)}`);
    const rows = await db.query<{ n: number }>(`SELECT count(*) AS n FROM ${quoteIdent('stacked')}`);
    expect(Number(rows[0].n)).toBe(a.dataset.rowCount + b.dataset.rowCount);
    void (db as QueryRunner);
  });

  it('detects asiakas_id → customers.id', async () => {
    const db = await NodeRunner.create();
    const orders = await processFixture(db, 'orders.csv', { dataLocale: 'en' });
    const customers = await processFixture(db, 'customers.csv');
    const rels = await detectRelationships(db, [orders.dataset, customers.dataset]);
    const match = rels.find((r) => r.from.datasetId === orders.dataset.id && r.to.datasetId === customers.dataset.id);
    expect(match?.from.columnId).toBe(orders.dataset.columns.find((c) => c.displayName === 'asiakas_id')?.id);
    expect(match?.to.columnId).toBe(customers.dataset.columns.find((c) => c.displayName === 'id')?.id);
    expect(match && match.score).toBeGreaterThanOrEqual(0.72);
  });
});

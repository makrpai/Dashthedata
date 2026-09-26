import { beforeAll, describe, expect, it } from 'vitest';
import { computeStats } from '@/lib/profile/stats';
import { NodeRunner } from '../../helpers/nodeRunner';

describe('computeStats (8.6)', () => {
  let db: NodeRunner;
  beforeAll(async () => {
    db = await NodeRunner.create();
    await db.exec(`CREATE TABLE t AS SELECT i AS n, CASE WHEN i % 10 = 0 THEN NULL ELSE ['Helsinki','Tampere','Oulu'][1 + i % 3] END AS city,
      DATE '2025-01-01' + CAST(i AS INTEGER) AS d FROM range(1, 101) r(i)`);
  });

  it('computes aggregates, top values and histograms', async () => {
    const [n, city, d] = await computeStats(
      db,
      't',
      [
        { sqlName: 'n', type: 'integer', top: false, histogram: true },
        { sqlName: 'city', type: 'text', top: true, histogram: false },
        { sqlName: 'd', type: 'date', top: false, histogram: false },
      ],
      100,
    );
    expect(n).toMatchObject({ count: 100, nulls: 0, distinct: 100, min: 1, max: 100, mean: 50.5, median: 50.5, sum: 5050 });
    expect(n.histogram).toHaveLength(20);
    expect(n.histogram!.reduce((a, b) => a + b.count, 0)).toBe(100);
    expect(city.nulls).toBe(10);
    expect(city.distinct).toBe(3);
    expect(city.top?.[0]).toEqual({ value: expect.any(String), count: 30 });
    expect(city.avgLength).toBeGreaterThan(4);
    expect(d).toMatchObject({ min: '2025-01-02', max: '2025-04-11' });
  });
});

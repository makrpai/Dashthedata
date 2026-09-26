'use client';

import { useEffect, useState } from 'react';
import { buildQuery, type BuiltQuery } from '@/lib/charts/queryBuilder';
import type { Row } from '@/lib/duckdb/types';
import { useRunner } from '@/lib/hooks/useRunner';
import { hash } from '@/lib/util/hash';
import { LRU } from '@/lib/util/lru';
import type { ChartSpec, Dataset, FilterClause } from '@/types/domain';

interface Result {
  rows: Row[];
  spark?: Row[];
}

/** Query results keyed by hash(sql + dataset version) (11.5). */
const cache = new LRU<string, Result>(200);

export interface ChartData {
  rows: Row[];
  spark?: Row[];
  query: BuiltQuery | null;
  loading: boolean;
  error: string | null;
  truncated: boolean;
}

export function useChartData(
  spec: ChartSpec,
  dataset: Dataset | undefined,
  filters: FilterClause[],
  enabled = true,
): ChartData {
  const runner = useRunner();
  let query: BuiltQuery | null = null;
  let buildError: string | null = null;
  try {
    query = dataset && dataset.columns.length ? buildQuery(spec, dataset, filters) : null;
  } catch (err) {
    buildError = err instanceof Error ? err.message : String(err);
  }
  const key = query && dataset ? hash(`${query.sql}|${query.sparkSql ?? ''}|${dataset.version}`) : null;
  const [state, setState] = useState<{ key: string | null; result: Result | null; error: string | null }>({ key: null, result: null, error: null });

  useEffect(() => {
    if (!runner || !query || !key || !enabled) return;
    if (cache.get(key)) return;
    let alive = true;
    const q = query;
    void (async () => {
      try {
        const rows = await runner.query(q.sql);
        const spark = q.sparkSql ? await runner.query(q.sparkSql) : undefined;
        const result = { rows, spark };
        cache.set(key, result);
        if (alive) setState({ key, result, error: null });
      } catch (err) {
        if (alive) setState({ key, result: null, error: err instanceof Error ? err.message.split('\n')[0] : String(err) });
      }
    })();
    return () => {
      alive = false;
    };
    // query is derived from key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, key, enabled]);

  const cached = key ? cache.get(key) : undefined;
  const result = cached ?? (state.key === key ? state.result : null);
  const rows = result?.rows ?? [];
  const limit = query?.limit;
  const truncated = limit !== undefined && rows.length > limit;
  return {
    rows: truncated ? rows.slice(0, limit) : rows,
    spark: result?.spark,
    query,
    loading: Boolean(key && !result && !(state.key === key && state.error)),
    error: buildError ?? (state.key === key ? state.error : null),
    truncated,
  };
}

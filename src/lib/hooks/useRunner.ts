'use client';

import { useEffect, useState } from 'react';
import type { BrowserRunner } from '@/lib/duckdb/client';
import { ensureEngine } from '@/lib/workspace/engine';

/** The DuckDB runner once the engine is ready (null while starting). */
export function useRunner(): BrowserRunner | null {
  const [runner, setRunner] = useState<BrowserRunner | null>(null);
  useEffect(() => {
    let alive = true;
    ensureEngine()
      .then((r) => alive && setRunner(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return runner;
}

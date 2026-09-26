'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { quoteIdent } from '@/lib/duckdb/sql';
import type { Row } from '@/lib/duckdb/types';
import { useRunner } from '@/lib/hooks/useRunner';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';

export interface PreviewColumn {
  /** Column name in the table. */
  name: string;
  label: React.ReactNode;
  /** Right-aligns numbers. */
  numeric?: boolean;
  width?: number;
  /** Optional extra header content (type icon, mini distribution…). */
  header?: React.ReactNode;
  format?: (value: unknown) => string;
}

const PAGE = 200;
const ROW_HEIGHT = 32;

/**
 * Virtualised table preview (19.2): rows are fetched in windows of 200 with LIMIT/OFFSET.
 * `version` invalidates the cache when the underlying table changes.
 */
export function DataPreview({
  table,
  fromSql,
  columns,
  rowCount,
  version,
  orderBy = '"__row"',
  highlight,
  className,
  label,
}: {
  table: string;
  /** Optional SQL used instead of the table (e.g. a before/after diff). */
  fromSql?: string;
  columns: PreviewColumn[];
  rowCount: number;
  version: number | string;
  orderBy?: string | null;
  /** Returns true for cells to highlight (before/after comparison). */
  highlight?: (rowIndex: number, column: string, row: Row) => boolean;
  className?: string;
  label: string;
}) {
  const t = useT();
  const runner = useRunner();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Map<number, Row[]>>(() => new Map());
  const loading = useRef(new Set<number>());
  const cacheKey = `${table}|${fromSql ?? ''}|${version}|${orderBy}|${columns.map((c) => c.name).join(',')}`;
  const [key, setKey] = useState(cacheKey);
  if (key !== cacheKey) {
    setKey(cacheKey);
    setPages(new Map());
  }

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });
  const items = virtualizer.getVirtualItems();
  const firstPage = items.length ? Math.floor(items[0].index / PAGE) : 0;
  const lastPage = items.length ? Math.floor(items[items.length - 1].index / PAGE) : 0;

  const currentKey = useRef(cacheKey);
  useEffect(() => {
    currentKey.current = cacheKey;
    loading.current = new Set();
  }, [cacheKey]);

  useEffect(() => {
    if (!runner || rowCount === 0) return;
    const source = fromSql ? `(${fromSql}) AS "__p"` : quoteIdent(table);
    const select = fromSql ? '*' : columns.map((c) => quoteIdent(c.name)).join(', ') || '*';
    for (let p = firstPage; p <= lastPage; p++) {
      if (pages.has(p) || loading.current.has(p)) continue;
      loading.current.add(p);
      const requestKey = cacheKey;
      runner
        .query(
          `SELECT ${select} FROM ${source}${orderBy ? ` ORDER BY ${orderBy}` : ''} LIMIT ${PAGE} OFFSET ${p * PAGE}`,
        )
        .then((rows) => {
          setPages((prev) => {
            if (requestKey !== currentKey.current) return prev;
            const next = new Map(prev);
            next.set(p, rows);
            return next;
          });
        })
        .catch(() => undefined)
        .finally(() => loading.current.delete(p));
    }
  }, [runner, firstPage, lastPage, pages, cacheKey, table, fromSql, columns, orderBy, rowCount]);

  const template = useMemo(
    () => `56px ${columns.map((c) => `${c.width ?? 168}px`).join(' ')}`,
    [columns],
  );
  const totalWidth = 56 + columns.reduce((w, c) => w + (c.width ?? 168), 0);

  return (
    <div className={cn('nm-flat flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-control)]', className)}>
      <div
        ref={scrollRef}
        role="grid"
        aria-label={label}
        aria-rowcount={rowCount + 1}
        aria-colcount={columns.length + 1}
        className="relative min-h-0 flex-1 overflow-auto text-[13px]"
      >
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          <div
            role="row"
            className="sticky top-0 z-10 grid border-b border-line-strong bg-surface"
            style={{ gridTemplateColumns: template }}
          >
            <div role="columnheader" className="px-2 py-2 text-right text-fg-2">
              #
            </div>
            {columns.map((c) => (
              <div role="columnheader" key={c.name} className="min-w-0 border-l border-line px-2.5 py-2">
                <div className={cn('truncate font-semibold', c.numeric && 'text-right')}>{c.label}</div>
                {c.header}
              </div>
            ))}
          </div>
          {rowCount === 0 ? (
            <p className="p-6 text-center text-fg-2">{t('preview.empty')}</p>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {items.map((item) => {
                const page = pages.get(Math.floor(item.index / PAGE));
                const row = page?.[item.index % PAGE];
                return (
                  <div
                    role="row"
                    aria-rowindex={item.index + 2}
                    key={item.key}
                    className="absolute left-0 grid w-full border-b border-line hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
                    style={{ top: 0, transform: `translateY(${item.start}px)`, height: ROW_HEIGHT, gridTemplateColumns: template }}
                  >
                    <div role="rowheader" className="tabular px-2 py-1.5 text-right text-fg-2">
                      {item.index + 1}
                    </div>
                    {columns.map((c) => {
                      const value = row?.[c.name];
                      const text = row ? (c.format ? c.format(value) : value === null || value === undefined ? '' : String(value)) : '';
                      const marked = row && highlight?.(item.index, c.name, row);
                      return (
                        <div
                          role="gridcell"
                          key={c.name}
                          title={text}
                          className={cn(
                            'min-w-0 truncate border-l border-line px-2.5 py-1.5',
                            c.numeric && 'tabular text-right',
                            row && (value === null || value === undefined) && 'text-fg-2/60 italic',
                            marked && 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]',
                          )}
                        >
                          {!row ? <span className="inline-block h-3 w-16 rounded bg-line-strong" /> : value === null || value === undefined ? t('common.blank') : text}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

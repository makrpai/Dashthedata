'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCell } from '@/lib/charts/format';
import type { Row } from '@/lib/duckdb/types';
import { useT } from '@/lib/i18n/useT';
import type { ColumnFormat, ColumnType } from '@/types/domain';

export interface TableColumn {
  key: string;
  label: string;
  type: ColumnType | 'varchar';
  format?: ColumnFormat;
  /** Custom label for category values (Other, blank…). */
  render?: (value: unknown) => string;
}

/** Flat, sortable table (charts' table type and "show as table", 19.3). */
export function TableView({ columns, rows, caption }: { columns: TableColumn[]; rows: Row[]; caption: string }) {
  const t = useT();
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), t.locale)) * sort.dir;
    });
  }, [rows, sort, t.locale]);
  const labels = { yes: t('common.yes'), no: t('common.no') };
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((c) => {
              const numeric = c.type === 'integer' || c.type === 'decimal';
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}
                  className={`border-b border-line-strong px-2 py-1.5 font-semibold ${numeric ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-fg"
                    onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: numeric ? -1 : 1 }))}
                  >
                    {c.label}
                    {active && (sort!.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-b border-line">
              {columns.map((c) => {
                const numeric = c.type === 'integer' || c.type === 'decimal';
                const v = r[c.key];
                return (
                  <td key={c.key} className={`px-2 py-1.5 ${numeric ? 'tabular text-right' : ''}`}>
                    {c.render ? c.render(v) : formatCell(v, c, t.locale, labels)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { Calendar, CalendarClock, CircleAlert, Hash, ToggleLeft, Type, type LucideIcon } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/useT';
import type { ColumnProfile, ColumnType } from '@/types/domain';

export const TYPE_ICONS: Record<ColumnType, LucideIcon> = {
  integer: Hash,
  decimal: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  datetime: CalendarClock,
  text: Type,
};

/** Tiny bar chart of the distribution: histogram for measures, top values otherwise. */
export function MiniDistribution({ column }: { column: ColumnProfile }) {
  const counts = column.stats.histogram?.map((h) => h.count) ?? column.stats.top?.map((t) => t.count) ?? [];
  if (counts.length === 0) return <div className="h-4" aria-hidden />;
  const max = Math.max(...counts, 1);
  const w = 60;
  const bw = w / counts.length;
  return (
    <svg width={w} height={16} viewBox={`0 0 ${w} 16`} aria-hidden className="shrink-0">
      {counts.map((c, i) => {
        const h = Math.max(1, (c / max) * 15);
        return <rect key={i} x={i * bw + 0.5} y={16 - h} width={Math.max(1, bw - 1)} height={h} rx={0.5} fill="var(--slate)" />;
      })}
    </svg>
  );
}

/** Column header in the preview: type icon, name, mini distribution, empty share, warnings (phase 2). */
export function ColumnHeaderInfo({ column }: { column: ColumnProfile }) {
  const t = useT();
  const Icon = TYPE_ICONS[column.type];
  const nullPct = column.stats.count ? Math.round((column.stats.nulls / column.stats.count) * 100) : 0;
  const warnings = column.warnings.map((w) =>
    t.dynamic(`profile.warning.${w.code}`, {
      ...w.params,
      ...(typeof w.params.examples === 'string' ? { examples: w.params.examples } : {}),
    }),
  );
  return (
    <div className="mt-1 flex items-center gap-2 text-[12px] font-normal text-fg-2">
      <Tooltip content={`${t.dynamic(`profile.type.${column.type}`)} · ${t.dynamic(`profile.role.${column.role}`)}`}>
        <span className="inline-flex" aria-label={`${t.dynamic(`profile.type.${column.type}`)}, ${t.dynamic(`profile.role.${column.role}`)}`}>
          <Icon className="size-3.5 text-slate" aria-hidden />
        </span>
      </Tooltip>
      <MiniDistribution column={column} />
      <span className="tabular">{t('profile.nulls', { pct: nullPct })}</span>
      {warnings.length > 0 && (
        <Tooltip content={<ul className="flex flex-col gap-1">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}>
          <button type="button" className="ml-auto inline-flex text-danger" aria-label={warnings.join(' ')}>
            <CircleAlert className="size-3.5" aria-hidden />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

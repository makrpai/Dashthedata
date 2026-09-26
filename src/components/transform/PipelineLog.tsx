'use client';

import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';
import type { PipelineStep, StepKind } from '@/types/domain';
import { StepCard, StepDot } from './StepCard';

export const ADDABLE_KINDS: StepKind[] = [
  'filterRows',
  'calculatedColumn',
  'renameColumn',
  'dropColumn',
  'splitColumn',
  'replaceValues',
  'sortRows',
  'dedupe',
  'trimWhitespace',
  'dropEmptyRows',
  'skipRows',
  'customSql',
];

/** Deterministic pseudo-random scatter so every dot starts from its own place. */
function scatter(i: number) {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { dx: `${Math.round((r(1) - 0.5) * 60)}px`, dy: `${Math.round((r(2) - 0.5) * 40)}px`, rot: `${Math.round((r(3) - 0.5) * 90)}deg` };
}

/** Counts up to the final row count (runs once with the settle animation). */
function CountUp({ from, to, run }: { from: number; to: number; run: boolean }) {
  const t = useT();
  const [value, setValue] = useState(run ? from : to);
  useEffect(() => {
    if (!run || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, run]);
  return <span className="tabular">{t('common.rows', { count: value })}</span>;
}

/**
 * Clean-up log (17.5): an inset vertical groove; automatic steps have a coral dot, suggestions a
 * coral ring and the user's steps a slate dot. After the automatic clean-up the dots settle into
 * the groove one after another and the row counter counts to the final value.
 */
export function PipelineLog({
  steps,
  sqlByStep,
  selected,
  animate,
  rawRows,
  finalRows,
  onSelect,
  onChange,
  onAdd,
  onEdit,
}: {
  steps: PipelineStep[];
  sqlByStep: Array<string | null>;
  selected: number | null;
  animate: boolean;
  rawRows: number;
  finalRows: number;
  onSelect: (index: number | null) => void;
  onChange: (steps: PipelineStep[]) => void;
  onAdd: (kind: StepKind) => void;
  onEdit: (index: number) => void;
}) {
  const t = useT();
  const [sqlOpen, setSqlOpen] = useState<Record<string, boolean>>({});
  const offsets = useMemo(() => steps.map((_, i) => scatter(i)), [steps]);
  const update = (i: number, patch: Partial<PipelineStep>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <section aria-label={t('etl.title')} className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17.5px] font-bold">{t('etl.title')}</h2>
        <span className="text-[13px] text-fg-2">
          <CountUp from={rawRows} to={finalRows} run={animate} />
        </span>
      </div>
      <ol className="relative flex flex-col gap-1.5 pl-7">
        <span aria-hidden className="nm-inset absolute top-1 bottom-1 left-[7px] w-[10px] rounded-full" />
        {steps.map((step, i) => (
          <li key={step.id} className="relative">
            <StepDot
              step={step}
              className={cn('absolute top-3.5 -left-[24px]', animate && 'dtd-settle')}
              style={
                animate
                  ? ({ '--dx': offsets[i].dx, '--dy': offsets[i].dy, '--rot': offsets[i].rot, '--delay': `${i * 60}ms` } as React.CSSProperties)
                  : undefined
              }
            />
            <StepCard
              step={step}
              index={i}
              selected={selected === i}
              sql={sqlByStep[i] ?? null}
              showSql={Boolean(sqlOpen[step.id])}
              onSelect={() => onSelect(selected === i ? null : i)}
              onToggle={(enabled) => update(i, { enabled })}
              onAccept={() => update(i, { enabled: true, suggested: false })}
              onRemove={() => onChange(steps.filter((_, j) => j !== i))}
              onEdit={() => onEdit(i)}
              onToggleSql={() => setSqlOpen((o) => ({ ...o, [step.id]: !o[step.id] }))}
            />
          </li>
        ))}
        <li className="relative pt-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="soft" size="sm">
                <Plus aria-hidden />
                {t('etl.addStep')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {ADDABLE_KINDS.map((k) => (
                <DropdownMenuItem key={k} onSelect={() => onAdd(k)}>
                  {t.dynamic(`etl.kinds.${k}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ol>
    </section>
  );
}

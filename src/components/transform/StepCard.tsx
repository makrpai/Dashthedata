'use client';

import { CircleAlert, Code2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { stepDefinition } from '@/lib/etl/steps';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';
import type { PipelineStep } from '@/types/domain';

/** Kinds the user can edit with the step editor. */
export const EDITABLE_KINDS = new Set([
  'skipRows',
  'renameColumn',
  'dropColumn',
  'filterRows',
  'calculatedColumn',
  'splitColumn',
  'replaceValues',
  'sortRows',
  'customSql',
]);

export function stepDescription(t: ReturnType<typeof useT>, step: PipelineStep): string {
  try {
    const d = stepDefinition(step.kind).describe(step.params as never, step.effect);
    return t.dynamic(d.key, d.params);
  } catch {
    return t.dynamic(`etl.kinds.${step.kind}`);
  }
}

export function StepDot({ step, style, className }: { step: PipelineStep; style?: React.CSSProperties; className?: string }) {
  const suggested = step.suggested;
  const user = step.origin === 'user';
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        'block size-3 rounded-full',
        suggested ? 'border-2 border-accent bg-base' : user ? 'bg-slate' : 'bg-accent',
        !step.enabled && !suggested && 'opacity-40',
        className,
      )}
    />
  );
}

export function StepCard({
  step,
  index,
  selected,
  sql,
  showSql,
  onSelect,
  onToggle,
  onRemove,
  onAccept,
  onEdit,
  onToggleSql,
}: {
  step: PipelineStep;
  index: number;
  selected: boolean;
  sql: string | null;
  showSql: boolean;
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
  onAccept: () => void;
  onEdit: () => void;
  onToggleSql: () => void;
}) {
  const t = useT();
  const nf = new Intl.NumberFormat(t.locale);
  const e = step.effect;
  const title = t.dynamic(`etl.kinds.${step.kind}`);
  return (
    <div
      className={cn(
        'group rounded-[var(--radius-control)] px-3 py-2.5 transition-colors',
        selected ? 'nm-pressed' : 'border-[length:var(--line-w)] border-transparent hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]',
        step.suggested && 'opacity-80',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${index + 1}. ${title}`}
        className="block w-full text-left"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold">
            {step.suggested && <span className="text-accent-fg">{t('etl.suggestion')}: </span>}
            {title}
          </span>
        </span>
        <span className="mt-0.5 block text-[13px] text-fg-2">{stepDescription(t, step)}</span>
        {e && !step.error && (e.rowsBefore !== e.rowsAfter || e.colsBefore !== e.colsAfter) && (
          <span className="tabular mt-1 block text-[12px] font-semibold text-fg">
            {e.rowsBefore !== e.rowsAfter
              ? t('etl.rowsEffect', { before: nf.format(e.rowsBefore), after: nf.format(e.rowsAfter) })
              : t('etl.colsEffect', { before: e.colsBefore, after: e.colsAfter })}
          </span>
        )}
      </button>
      {step.error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-danger" role="alert">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t('etl.error.title')} {t.dynamic(`etl.error.${step.error.code}`, step.error.params)}
          </span>
        </p>
      )}
      <div className="mt-2 flex items-center gap-1">
        {step.suggested ? (
          <Button size="sm" variant="soft" onClick={onAccept}>
            {t('etl.accept')}
          </Button>
        ) : (
          <Switch checked={step.enabled} onCheckedChange={onToggle} aria-label={`${t('etl.stepEnabled')}: ${title}`} />
        )}
        {step.confidence !== undefined && step.origin === 'auto' && (
          <span className="ml-1 text-[11px] text-fg-2">{t('etl.confidence', { pct: Math.round(step.confidence * 100) })}</span>
        )}
        <span className="ml-auto flex items-center">
          {sql && (
            <Tooltip content={t('etl.showSql')}>
              <Button size="iconSm" variant="ghost" aria-label={t('etl.showSql')} aria-pressed={showSql} onClick={onToggleSql}>
                <Code2 aria-hidden />
              </Button>
            </Tooltip>
          )}
          {EDITABLE_KINDS.has(step.kind) && (
            <Tooltip content={t('etl.editStep')}>
              <Button size="iconSm" variant="ghost" aria-label={`${t('etl.editStep')}: ${title}`} onClick={onEdit}>
                <Pencil aria-hidden />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={step.suggested ? t('etl.dismiss') : t('etl.removeStep')}>
            <Button size="iconSm" variant="ghost" aria-label={`${step.suggested ? t('etl.dismiss') : t('etl.removeStep')}: ${title}`} onClick={onRemove}>
              <Trash2 aria-hidden />
            </Button>
          </Tooltip>
        </span>
      </div>
      {showSql && sql && (
        <pre className="nm-flat mt-2 max-h-48 overflow-auto rounded-[8px] p-2 font-mono text-[11px] whitespace-pre-wrap text-fg">
          {sql}
        </pre>
      )}
    </div>
  );
}

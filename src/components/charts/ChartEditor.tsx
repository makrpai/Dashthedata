'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { buildQuery } from '@/lib/charts/queryBuilder';
import { CHART_TYPES, suitableTypes } from '@/lib/charts/spec';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';
import type { Agg, ChartSpec, ColumnProfile, ColumnRole, Dataset, FilterOp, TimeGrain } from '@/types/domain';
import { CHART_ICONS } from './chartIcons';
import { ChartView } from './ChartView';

const AGGS: Agg[] = ['sum', 'avg', 'count', 'countDistinct', 'min', 'max', 'median'];
const GRAINS: TimeGrain[] = ['day', 'week', 'month', 'quarter', 'year'];
const ROLE_ORDER: ColumnRole[] = ['time', 'dimension', 'measure', 'id', 'text'];
const NONE = '__none__';
const OPS: FilterOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'isNull', 'notNull'];

function ColumnPicker({
  id,
  label,
  columns,
  value,
  onChange,
  allowNone,
  roles,
}: {
  id: string;
  label: string;
  columns: ColumnProfile[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  allowNone?: boolean;
  roles?: ColumnRole[];
}) {
  const t = useT();
  const groups = ROLE_ORDER.filter((r) => !roles || roles.includes(r))
    .map((r) => [r, columns.filter((c) => c.role === r)] as const)
    .filter(([, cs]) => cs.length);
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={id}>{label}</Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>{t('chart.editor.none')}</SelectItem>}
          {groups.map(([role, cs]) => (
            <SelectGroup key={role}>
              <SelectLabel>{t.dynamic(`chart.editor.groups.${role}`)}</SelectLabel>
              {cs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Chart editor side panel (11.4) with a live preview (150 ms debounce). */
export function ChartEditor({
  open,
  initial,
  datasets,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: ChartSpec;
  datasets: Dataset[];
  onSave: (spec: ChartSpec) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [spec, setSpec] = useState<ChartSpec>(initial);
  const [preview, setPreview] = useState<ChartSpec>(initial);
  const [showSql, setShowSql] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setPreview(spec), 150);
    return () => clearTimeout(id);
  }, [spec]);
  const dataset = datasets.find((d) => d.id === spec.datasetId);
  const cols = dataset?.columns ?? [];
  const problems = dataset ? suitableTypes(spec, dataset) : null;
  const set = (patch: Partial<ChartSpec>) => setSpec((s) => ({ ...s, ...patch, origin: s.origin === 'rule' || s.origin === 'ai' ? s.origin : 'user' }));
  const x = cols.find((c) => c.id === spec.x?.columnId);
  const xIsTime = x?.type === 'date' || x?.type === 'datetime';
  let sql = '';
  try {
    sql = dataset ? buildQuery(spec, dataset).sql : '';
  } catch {
    sql = '';
  }
  const clause = spec.filters?.[0];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" closeLabel={t('common.close')} className="w-[min(46rem,98vw)]">
        <SheetTitle className="text-[17.5px] font-bold">{t('chart.editChart')}</SheetTitle>
        <SheetDescription className="sr-only">{t('chart.editor.preview')}</SheetDescription>
        <div className="nm-flat h-64 shrink-0 rounded-[var(--radius-control)] p-3" aria-label={t('chart.editor.preview')}>
          <ChartView spec={preview} dataset={dataset} filters={[]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {datasets.length > 1 && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label id="ce-ds">{t('chart.editor.dataset')}</Label>
              <Select value={spec.datasetId} onValueChange={(v) => set({ datasetId: v, x: undefined, y: [{ columnId: '*', agg: 'count' }], series: undefined, filters: [] })}>
                <SelectTrigger aria-labelledby="ce-ds">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[13px] font-semibold text-fg-2">{t('chart.editor.type')}</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('chart.editor.type')}>
              {CHART_TYPES.map((type) => {
                const Icon = CHART_ICONS[type];
                const issues = problems?.[type] ?? [];
                const active = spec.type === type;
                const button = (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t.dynamic(`chart.types.${type}`)}
                    onClick={() => set({ type })}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-[10px] border-[length:var(--line-w)] border-line',
                      active ? 'nm-pressed text-fg' : 'nm-raised-sm text-slate',
                      !active && issues.length > 0 && 'opacity-40',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </button>
                );
                return (
                  <Tooltip
                    key={type}
                    content={
                      <span>
                        {t.dynamic(`chart.types.${type}`)}
                        {issues.length > 0 && <span className="block text-[12px] opacity-80">{issues.map((p) => t.dynamic(`chart.problems.${p}`)).join(' ')}</span>}
                      </span>
                    }
                  >
                    {button}
                  </Tooltip>
                );
              })}
            </div>
          </fieldset>
          {spec.type !== 'kpi' && (
            <ColumnPicker
              id="ce-x"
              label={t('chart.editor.x')}
              columns={cols}
              value={spec.x?.columnId}
              allowNone={spec.type === 'table'}
              onChange={(v) => set({ x: v ? { columnId: v } : undefined })}
            />
          )}
          {xIsTime && spec.type !== 'kpi' && (
            <div className="flex flex-col gap-1.5">
              <Label id="ce-grain">{t('chart.editor.grain')}</Label>
              <Select value={spec.x?.timeGrain ?? NONE} onValueChange={(v) => set({ x: { ...spec.x!, timeGrain: v === NONE ? undefined : (v as TimeGrain) } })}>
                <SelectTrigger aria-labelledby="ce-grain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('chart.editor.auto')}</SelectItem>
                  {GRAINS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {t.dynamic(`chart.grain.${g}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {spec.type !== 'histogram' && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              {spec.y.map((y, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label id={`ce-y${i}`}>{t('chart.editor.y')}</Label>
                    <Select value={y.columnId} onValueChange={(v) => set({ y: spec.y.map((yy, j) => (j === i ? { ...yy, columnId: v, agg: v === '*' ? 'count' : yy.agg } : yy)) })}>
                      <SelectTrigger aria-labelledby={`ce-y${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="*">{t('chart.rowCount')}</SelectItem>
                        {cols.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label id={`ce-agg${i}`}>{t('chart.editor.agg')}</Label>
                    <Select value={y.agg} onValueChange={(v) => set({ y: spec.y.map((yy, j) => (j === i ? { ...yy, agg: v as Agg } : yy)) })} disabled={y.columnId === '*'}>
                      <SelectTrigger aria-labelledby={`ce-agg${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGGS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {t.dynamic(`chart.agg.${a}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {spec.y.length > 1 ? (
                    <Button variant="ghost" size="icon" aria-label={t('chart.editor.removeMeasure')} onClick={() => set({ y: spec.y.filter((_, j) => j !== i) })}>
                      <Minus aria-hidden />
                    </Button>
                  ) : (
                    <span className="size-9" />
                  )}
                </div>
              ))}
              {spec.y.length < 3 && ['line', 'area', 'bar', 'hbar', 'table'].includes(spec.type) && (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => set({ y: [...spec.y, { columnId: '*', agg: 'count' }] })}>
                  <Plus aria-hidden />
                  {t('chart.editor.addMeasure')}
                </Button>
              )}
            </div>
          )}
          {['line', 'area', 'stackedBar', 'scatter', 'heatmap'].includes(spec.type) && (
            <ColumnPicker
              id="ce-s"
              label={t('chart.editor.series')}
              columns={cols}
              roles={['dimension', 'id', 'text']}
              value={spec.series?.columnId}
              allowNone={spec.type !== 'stackedBar' && spec.type !== 'heatmap'}
              onChange={(v) => set({ series: v ? { columnId: v } : undefined })}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ce-title">{t('chart.editor.title')}</Label>
            <Input id="ce-title" value={spec.title ?? ''} placeholder={t('chart.editor.titlePlaceholder')} onChange={(e) => set({ title: e.target.value || undefined })} />
          </div>
          {spec.type === 'kpi' && (
            <label className="flex items-center gap-3 sm:col-span-2">
              <Switch checked={Boolean(spec.options?.compareToPrevious)} onCheckedChange={(v) => set({ options: { ...spec.options, compareToPrevious: v } })} aria-label={t('chart.editor.compare')} />
              {t('chart.editor.compare')}
            </label>
          )}
          {['bar', 'hbar'].includes(spec.type) && (
            <label className="flex items-center gap-3">
              <Switch checked={Boolean(spec.options?.showLabels)} onCheckedChange={(v) => set({ options: { ...spec.options, showLabels: v } })} aria-label={t('chart.editor.labels')} />
              {t('chart.editor.labels')}
            </label>
          )}
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1 text-[13px] font-semibold text-fg-2">{t('chart.editor.filters')}</legend>
            {clause ? (
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                <Select value={clause.columnId} onValueChange={(v) => set({ filters: [{ ...clause, columnId: v }] })}>
                  <SelectTrigger aria-label={t('transform.editor.column')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cols.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={clause.op} onValueChange={(v) => set({ filters: [{ ...clause, op: v as FilterOp }] })}>
                  <SelectTrigger aria-label={t('transform.editor.operator')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {t.dynamic(`transform.ops.${op}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input aria-label={t('transform.editor.value')} value={String(clause.value ?? '')} onChange={(e) => set({ filters: [{ ...clause, value: e.target.value }] })} />
                <Button variant="ghost" size="icon" aria-label={t('common.delete')} onClick={() => set({ filters: [] })}>
                  <Minus aria-hidden />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => cols[0] && set({ filters: [{ columnId: cols[0].id, op: 'eq', value: '' }] })}>
                <Plus aria-hidden />
                {t('chart.editor.addFilter')}
              </Button>
            )}
          </fieldset>
          <div className="sm:col-span-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSql((v) => !v)} aria-pressed={showSql}>
              {showSql ? t('common.hideSql') : t('common.showSql')}
            </Button>
            {showSql && <pre className="nm-flat mt-2 max-h-48 overflow-auto rounded-[8px] p-2 font-mono text-[11px] whitespace-pre-wrap">{sql}</pre>}
          </div>
        </div>
        <div className="mt-auto flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={(problems?.[spec.type] ?? []).length > 0} onClick={() => onSave(spec)}>
            {t('chart.editor.save')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

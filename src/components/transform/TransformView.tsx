'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { Tooltip } from '@/components/ui/tooltip';
import { ViewHeader } from '@/components/views/ViewHeader';
import { formatCell } from '@/lib/charts/format';
import { quoteIdent } from '@/lib/duckdb/sql';
import { userStep, withReinterpretation, withTypeOverride } from '@/lib/etl/edit';
import type { ColumnRef } from '@/lib/etl/types';
import { useT } from '@/lib/i18n/useT';
import { EMPTY } from '@/lib/util/empty';
import { redoPipeline, runDataset, setPipeline, undoPipeline } from '@/lib/workspace/engine';
import { useProjectStore } from '@/store';
import { usePipelineStore } from '@/store/pipeline';
import { useUiStore } from '@/store/ui';
import type { ColumnProfile, PipelineStep, StepKind } from '@/types/domain';
import { ColumnHeaderInfo, TYPE_ICONS } from './ColumnHeader';
import { ColumnHeaderMenu, type ColumnAction } from './ColumnHeaderMenu';
import { DataPreview, type PreviewColumn } from './DataPreview';
import { PipelineLog } from './PipelineLog';
import { defaultParams, StepEditor } from './StepEditor';

interface EditorState {
  kind: StepKind;
  index: number | null;
  columns: ColumnRef[];
  initial: Record<string, unknown>;
}

const MEASURED = new Set(['trimWhitespace', 'fillDown', 'castTypes', 'standardizeCategories', 'replaceValues']);

export function TransformView({ datasetId }: { datasetId?: string }) {
  const t = useT();
  const router = useRouter();
  const datasets = useProjectStore((s) => s.project?.datasets ?? EMPTY);
  const sources = useProjectStore((s) => s.project?.sources ?? EMPTY);
  const busy = useProjectStore((s) => s.busyDatasets);
  const dataset = datasets.find((d) => d.id === datasetId) ?? (datasetId ? undefined : datasets[0]);
  const run = usePipelineStore((s) => (dataset ? s.runs[dataset.id] : undefined));
  const history = usePipelineStore((s) => (dataset ? s.history[dataset.id] : undefined));
  const setBreadcrumb = useUiStore((s) => s.setBreadcrumbExtra);
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<'before' | 'after'>('after');
  const [editor, setEditor] = useState<EditorState | null>(null);

  useEffect(() => {
    setBreadcrumb(dataset?.name ?? null);
    return () => setBreadcrumb(null);
  }, [dataset?.name, setBreadcrumb]);

  // Views live in DuckDB memory; rebuild them if this page opens without a run (e.g. after reload).
  useEffect(() => {
    if (dataset && !run && !busy.includes(dataset.id)) void runDataset(dataset.id);
  }, [dataset, run, busy]);

  // The settle animation plays once.
  useEffect(() => {
    if (!dataset || !run?.justDetected) return;
    const id = setTimeout(() => usePipelineStore.getState().clearJustDetected(dataset.id), 2500);
    return () => clearTimeout(id);
  }, [dataset, run?.justDetected]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (9.1).
  useEffect(() => {
    if (!dataset) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return;
      e.preventDefault();
      void (e.shiftKey ? redoPipeline(dataset.id) : undoPipeline(dataset.id));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dataset]);

  const steps = dataset?.pipeline ?? EMPTY;
  const columnsBefore = useMemo(
    () => (i: number) => (i <= 0 ? (run?.baseColumns ?? []) : (run?.columnsByStep[i - 1] ?? [])),
    [run],
  );

  if (!dataset) {
    return (
      <>
        <ViewHeader title={t('views.transform.title')} />
        <Card>
          <EmptyState
            text={t('views.transform.empty')}
            action={
              <Button asChild variant="primary">
                <Link href="/workspace/data">{t('views.goToData')}</Link>
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const isBusy = busy.includes(dataset.id);
  const source = sources.find((s) => s.id === dataset.sourceIds[0]);
  const change = (next: PipelineStep[]) => void setPipeline(dataset.id, next);
  const finalColumns = run?.columnsByStep[steps.length - 1] ?? run?.baseColumns ?? [];

  const openEditor = (kind: StepKind, index: number | null, preset?: Record<string, unknown>, columnId?: string) => {
    const cols = index === null ? finalColumns : columnsBefore(index);
    setEditor({ kind, index, columns: cols, initial: preset ?? defaultParams(kind, cols, columnId) });
  };

  const onColumnAction = (column: ColumnProfile, a: ColumnAction) => {
    switch (a.kind) {
      case 'rename':
        return openEditor('renameColumn', null, { columnId: column.id, displayName: column.displayName });
      case 'remove':
        return change([...steps, userStep('dropColumn', { columnId: column.id, name: column.displayName })]);
      case 'filter':
        return openEditor('filterRows', null, undefined, column.id);
      case 'split':
        return openEditor('splitColumn', null, undefined, column.id);
      case 'replace':
        return openEditor('replaceValues', null, undefined, column.id);
      case 'calculated':
        return openEditor('calculatedColumn', null);
      case 'sort': {
        const trimmed = steps[steps.length - 1]?.kind === 'sortRows' && steps[steps.length - 1].origin === 'user' ? steps.slice(0, -1) : steps;
        return change([...trimmed, userStep('sortRows', { by: [{ columnId: column.id, dir: a.dir }] })]);
      }
      case 'type':
        return change(withTypeOverride(steps, columnsBefore, column.id, a.to));
      case 'reinterpret':
        return change(withReinterpretation(steps, column.id));
      case 'role':
        useProjectStore.getState().updateDataset(dataset.id, (d) => ({ ...d, roleOverrides: { ...d.roleOverrides, [column.id]: a.to } }));
        void runDataset(dataset.id);
        return;
    }
  };

  // ---------- preview ----------
  const labels = { yes: t('common.yes'), no: t('common.no') };
  let preview: { table: string; fromSql?: string; columns: PreviewColumn[]; rows: number; title: string; changed: boolean } | null = null;
  if (run) {
    if (selected === null) {
      preview = {
        table: dataset.outputTable,
        rows: dataset.rowCount,
        title: t('etl.previewFinal', { name: dataset.name }),
        changed: false,
        columns: dataset.columns.map((c) => ({
          name: c.sqlName,
          numeric: c.type === 'integer' || c.type === 'decimal',
          label: (
            <span className="flex items-center gap-1">
              <span className="truncate">{c.displayName}</span>
              <ColumnHeaderMenu column={c} onAction={(a) => onColumnAction(c, a)} />
            </span>
          ),
          header: <ColumnHeaderInfo column={c} />,
          format: (v) => formatCell(v, c, t.locale, labels),
        })),
      };
    } else {
      const step = steps[selected];
      const afterView = run.viewByStep[selected];
      const beforeView = selected === 0 ? run.baseView : run.viewByStep[selected - 1];
      const useBefore = mode === 'before';
      const view = useBefore ? beforeView : afterView;
      const cols = useBefore ? columnsBefore(selected) : (run.columnsByStep[selected] ?? []);
      const beforeCols = columnsBefore(selected);
      const diff = !useBefore && MEASURED.has(step.kind) && step.enabled && !step.suggested && !step.error;
      const prevById = new Map(beforeCols.map((c) => [c.id, c]));
      const fromSql = diff
        ? `SELECT a.*, ${cols
            .map((c) => {
              const p = prevById.get(c.id);
              return p
                ? `(CAST(a.${quoteIdent(c.sqlName)} AS VARCHAR) IS DISTINCT FROM CAST(b.${quoteIdent(p.sqlName)} AS VARCHAR)) AS ${quoteIdent(`__chg_${c.sqlName}`)}`
                : `FALSE AS ${quoteIdent(`__chg_${c.sqlName}`)}`;
            })
            .join(', ')} FROM ${quoteIdent(afterView)} a LEFT JOIN ${quoteIdent(beforeView)} b USING ("__row")`
        : undefined;
      const e = step.effect;
      preview = {
        table: view,
        fromSql,
        rows: (useBefore ? e?.rowsBefore : e?.rowsAfter) ?? dataset.rowCount,
        title: t('etl.previewAt', { step: t.dynamic(`etl.kinds.${step.kind}`) }),
        changed: diff,
        columns: cols.map((c) => {
          const Icon = TYPE_ICONS[c.type === 'varchar' ? 'text' : c.type];
          return {
            name: c.sqlName,
            numeric: c.type === 'integer' || c.type === 'decimal',
            label: (
              <span className="flex items-center gap-1.5">
                <Icon className="size-3.5 shrink-0 text-slate" aria-hidden />
                <span className="truncate">{c.displayName}</span>
              </span>
            ),
            format: (v) => formatCell(v, c, t.locale, labels),
          };
        }),
      };
    }
  }

  return (
    <>
      <ViewHeader
        title={t('views.transform.title')}
        actions={
          <>
            {datasets.length > 1 && (
              <Select value={dataset.id} onValueChange={(id) => router.push(`/workspace/transform/${id}`)}>
                <SelectTrigger className="w-64" aria-label={t('etl.datasetPicker')}>
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
            )}
            <Tooltip content={`${t('etl.undo')} (Ctrl+Z)`}>
              <Button variant="soft" size="icon" aria-label={t('etl.undo')} disabled={!history?.past.length || isBusy} onClick={() => void undoPipeline(dataset.id)}>
                <Undo2 aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip content={`${t('etl.redo')} (Ctrl+Shift+Z)`}>
              <Button variant="soft" size="icon" aria-label={t('etl.redo')} disabled={!history?.future.length || isBusy} onClick={() => void redoPipeline(dataset.id)}>
                <Redo2 aria-hidden />
              </Button>
            </Tooltip>
          </>
        }
      />
      {dataset.notes?.length ? <p className="-mt-3 mb-4 text-[13px] text-fg-2">{t('etl.notes', { notes: dataset.notes.join(' · ') })}</p> : null}
      <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <Card className="self-start p-4">
          <PipelineLog
            steps={steps}
            sqlByStep={run?.sqlByStep ?? []}
            selected={selected}
            animate={Boolean(run?.justDetected)}
            rawRows={source?.rowCount ?? dataset.rowCount}
            finalRows={dataset.rowCount}
            onSelect={setSelected}
            onChange={(next) => {
              if (selected !== null && selected >= next.length) setSelected(null);
              change(next);
            }}
            onAdd={(kind) => {
              if (kind === 'dedupe' || kind === 'dropEmptyRows') change([...steps, userStep(kind, {})]);
              else openEditor(kind, null);
            }}
            onEdit={(i) => openEditor(steps[i].kind, i, steps[i].params)}
          />
        </Card>
        <section className="flex min-w-0 flex-col gap-3" aria-busy={isBusy}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[17.5px] font-bold">{preview?.title ?? t('etl.finalResult')}</h2>
            {isBusy && (
              <span className="flex items-center gap-2 text-[13px] text-fg-2" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t('etl.running')}
              </span>
            )}
            {selected !== null && (
              <>
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'before' | 'after')}>
                  <TabsList>
                    <TabsTrigger value="before">{t('etl.before')}</TabsTrigger>
                    <TabsTrigger value="after">{t('etl.after')}</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  {t('etl.finalResult')}
                </Button>
              </>
            )}
          </div>
          {preview && (
            <>
              <p className="text-[13px] text-fg-2">
                {t('preview.summary', { rows: t('common.rows', { count: preview.rows }), columns: t('common.columns', { count: preview.columns.length }) })}
                {preview.changed && ` · ${t('etl.changedCells')}`}
              </p>
              <DataPreview
                label={preview.title}
                table={preview.table}
                fromSql={preview.fromSql}
                columns={preview.columns}
                rowCount={preview.rows}
                version={`${run?.runId}|${selected}|${mode}`}
                highlight={preview.changed ? (_i, name, row) => row[`__chg_${name}`] === true : undefined}
                className="h-[calc(100vh-260px)] min-h-[420px]"
              />
            </>
          )}
        </section>
      </div>
      {editor && (
        <StepEditor
          kind={editor.kind}
          columns={editor.columns}
          initial={editor.initial}
          onClose={() => setEditor(null)}
          onSave={(params) => {
            const next =
              editor.index === null
                ? [...steps, userStep(editor.kind, params)]
                : steps.map((s, i) => (i === editor.index ? { ...s, params } : s));
            setEditor(null);
            change(next);
            toast.success(t.dynamic(`etl.kinds.${editor.kind}`));
          }}
        />
      )}
    </>
  );
}

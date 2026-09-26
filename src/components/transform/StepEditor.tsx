'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { compileExpression, ExpressionError } from '@/lib/etl/expression';
import { stepDefinition } from '@/lib/etl/steps';
import type { ColumnRef } from '@/lib/etl/types';
import { useT } from '@/lib/i18n/useT';
import { newId } from '@/lib/util/id';
import type { FilterOp, StepKind } from '@/types/domain';

type Params = Record<string, unknown>;

const OPS: FilterOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'isNull', 'notNull'];

/** Default parameters for a new step of a kind, optionally for a given column. */
export function defaultParams(kind: StepKind, columns: ColumnRef[], columnId?: string): Params {
  const first = columnId ?? columns[0]?.id ?? '';
  const name = columns.find((c) => c.id === first)?.displayName ?? '';
  switch (kind) {
    case 'skipRows':
      return { count: 1 };
    case 'renameColumn':
      return { columnId: first, displayName: name };
    case 'dropColumn':
      return { columnId: first, name };
    case 'filterRows':
      return { clauses: [{ columnId: first, op: 'eq', value: '' }], mode: 'keep' };
    case 'calculatedColumn':
      return { displayName: '', expression: '', columnId: newId('calc') };
    case 'splitColumn':
      return { columnId: first, delimiter: ',', parts: 2, names: [], columnIds: [newId('split'), newId('split')] };
    case 'replaceValues':
      return { columnId: first, find: '', replace: '', matchWhole: false };
    case 'sortRows':
      return { by: [{ columnId: first, dir: 'asc' }] };
    case 'dedupe':
      return {};
    case 'trimWhitespace':
      return { columnIds: columns.filter((c) => c.type === 'varchar' || c.type === 'text').map((c) => c.id) };
    case 'customSql':
      return { sql: 'SELECT *\nFROM {{input}}' };
    default:
      return {};
  }
}

function ColumnSelect({ columns, value, onChange, label, id }: { columns: ColumnRef[]; value: string; onChange: (v: string) => void; label: string; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StepEditor({
  kind,
  columns,
  initial,
  onSave,
  onClose,
}: {
  kind: StepKind;
  columns: ColumnRef[];
  initial: Params;
  onSave: (params: Params) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [p, setP] = useState<Params>(initial);
  const set = (patch: Params) => setP((x) => ({ ...x, ...patch }));
  const colName = (id: unknown) => columns.find((c) => c.id === id)?.displayName ?? '';

  const exprError = useMemo(() => {
    if (kind !== 'calculatedColumn' || !String(p.expression ?? '').trim()) return null;
    try {
      compileExpression(String(p.expression), columns, t.locale);
      return null;
    } catch (err) {
      if (err instanceof ExpressionError) {
        return `${t.dynamic(err.key, err.params)} (${t('expression.position', { pos: err.position + 1 })})`;
      }
      return t('transform.editor.invalid');
    }
  }, [kind, p.expression, columns, t]);

  const valid = useMemo(() => {
    if (exprError) return false;
    return stepDefinition(kind).paramsSchema.safeParse(p).success;
  }, [kind, p, exprError]);

  const clause = (p.clauses as Array<{ columnId: string; op: FilterOp; value?: unknown }> | undefined)?.[0];
  const setClause = (patch: Record<string, unknown>) => set({ clauses: [{ ...clause, ...patch }] });

  const fields = (() => {
    switch (kind) {
      case 'skipRows':
        return (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="se-count">{t('transform.editor.count')}</Label>
            <Input id="se-count" type="number" min={0} value={String(p.count ?? 0)} onChange={(e) => set({ count: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
        );
      case 'renameColumn':
        return (
          <>
            <ColumnSelect id="se-col" label={t('transform.editor.column')} columns={columns} value={String(p.columnId)} onChange={(v) => set({ columnId: v, displayName: colName(v) })} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="se-name">{t('transform.editor.newName')}</Label>
              <Input id="se-name" value={String(p.displayName ?? '')} onChange={(e) => set({ displayName: e.target.value })} />
            </div>
          </>
        );
      case 'dropColumn':
        return <ColumnSelect id="se-col" label={t('transform.editor.column')} columns={columns} value={String(p.columnId)} onChange={(v) => set({ columnId: v, name: colName(v) })} />;
      case 'filterRows':
        return (
          <>
            <ColumnSelect id="se-col" label={t('transform.editor.column')} columns={columns} value={clause?.columnId ?? ''} onChange={(v) => setClause({ columnId: v })} />
            <div className="flex flex-col gap-1.5">
              <Label id="se-op">{t('transform.editor.operator')}</Label>
              <Select value={clause?.op ?? 'eq'} onValueChange={(v) => setClause({ op: v })}>
                <SelectTrigger aria-labelledby="se-op">
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
            </div>
            {clause && clause.op !== 'isNull' && clause.op !== 'notNull' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="se-value">{t('transform.editor.value')}</Label>
                <Input
                  id="se-value"
                  value={String(clause.value ?? '')}
                  onChange={(e) => {
                    const c = columns.find((x) => x.id === clause.columnId);
                    const numeric = c?.type === 'integer' || c?.type === 'decimal';
                    const raw = e.target.value;
                    setClause({ value: numeric && raw.trim() !== '' && !Number.isNaN(Number(raw.replace(',', '.'))) ? Number(raw.replace(',', '.')) : raw });
                  }}
                />
              </div>
            )}
            <Segmented
              ariaLabel={t('transform.editor.mode')}
              value={String(p.mode) as 'keep' | 'remove'}
              onChange={(v) => set({ mode: v })}
              options={[
                { value: 'keep', label: t('transform.editor.keep') },
                { value: 'remove', label: t('transform.editor.remove') },
              ]}
            />
          </>
        );
      case 'calculatedColumn':
        return (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="se-name">{t('transform.editor.name')}</Label>
              <Input id="se-name" value={String(p.displayName ?? '')} onChange={(e) => set({ displayName: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="se-expr">{t('transform.editor.expression')}</Label>
              <Textarea
                id="se-expr"
                className="font-mono text-[13px]"
                value={String(p.expression ?? '')}
                onChange={(e) => set({ expression: e.target.value })}
                aria-invalid={Boolean(exprError)}
                aria-describedby="se-expr-hint"
              />
              <p id="se-expr-hint" className="text-[12px] text-fg-2">
                {t('transform.editor.expressionHint')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="nm-raised-sm rounded-full px-2.5 py-0.5 text-[12px]"
                    onClick={() => set({ expression: `${String(p.expression ?? '')}[${c.displayName.replace(/]/g, ']]')}]` })}
                  >
                    {c.displayName}
                  </button>
                ))}
              </div>
              {exprError && (
                <p className="text-[12px] text-danger" role="alert">
                  {exprError}
                </p>
              )}
            </div>
          </>
        );
      case 'splitColumn':
        return (
          <>
            <ColumnSelect id="se-col" label={t('transform.editor.column')} columns={columns} value={String(p.columnId)} onChange={(v) => set({ columnId: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="se-delim">{t('transform.editor.delimiter')}</Label>
                <Input id="se-delim" value={String(p.delimiter ?? '')} onChange={(e) => set({ delimiter: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="se-parts">{t('transform.editor.parts')}</Label>
                <Input
                  id="se-parts"
                  type="number"
                  min={2}
                  max={10}
                  value={String(p.parts ?? 2)}
                  onChange={(e) => {
                    const parts = Math.min(10, Math.max(2, Number(e.target.value) || 2));
                    const ids = [...((p.columnIds as string[]) ?? [])];
                    while (ids.length < parts) ids.push(newId('split'));
                    set({ parts, columnIds: ids.slice(0, parts) });
                  }}
                />
              </div>
            </div>
          </>
        );
      case 'replaceValues':
        return (
          <>
            <ColumnSelect id="se-col" label={t('transform.editor.column')} columns={columns} value={String(p.columnId)} onChange={(v) => set({ columnId: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="se-find">{t('transform.editor.find')}</Label>
                <Input id="se-find" value={String(p.find ?? '')} onChange={(e) => set({ find: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="se-repl">{t('transform.editor.replaceWith')}</Label>
                <Input id="se-repl" value={String(p.replace ?? '')} onChange={(e) => set({ replace: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-3">
              <Switch checked={Boolean(p.matchWhole)} onCheckedChange={(v) => set({ matchWhole: v })} aria-label={t('transform.editor.matchWhole')} />
              {t('transform.editor.matchWhole')}
            </label>
          </>
        );
      case 'sortRows': {
        const by = (p.by as Array<{ columnId: string; dir: 'asc' | 'desc' }>)[0];
        return (
          <>
            <ColumnSelect id="se-col" label={t('transform.editor.column')} columns={columns} value={by.columnId} onChange={(v) => set({ by: [{ ...by, columnId: v }] })} />
            <Segmented
              ariaLabel={t('transform.editor.direction')}
              value={by.dir}
              onChange={(v) => set({ by: [{ ...by, dir: v }] })}
              options={[
                { value: 'asc', label: t('transform.editor.asc') },
                { value: 'desc', label: t('transform.editor.desc') },
              ]}
            />
          </>
        );
      }
      case 'dedupe':
      case 'trimWhitespace': {
        const key = kind === 'dedupe' ? 'columnIds' : 'columnIds';
        const selected = new Set((p[key] as string[] | undefined) ?? []);
        return (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-semibold text-fg-2">
              {t('transform.editor.columns')}
              {kind === 'dedupe' && selected.size === 0 && ` · ${t('transform.editor.allColumns')}`}
            </legend>
            {columns.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5">
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v === true) next.add(c.id);
                    else next.delete(c.id);
                    set({ [key]: [...next] });
                  }}
                />
                {c.displayName}
              </label>
            ))}
          </fieldset>
        );
      }
      case 'customSql':
        return (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="se-sql">{t('transform.editor.sql')}</Label>
            <Textarea id="se-sql" className="min-h-40 font-mono text-[13px]" value={String(p.sql ?? '')} onChange={(e) => set({ sql: e.target.value })} />
            <p className="text-[12px] text-fg-2">{t('transform.editor.sqlHint')}</p>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.dynamic(`etl.kinds.${kind}`)}</DialogTitle>
          <DialogDescription className="sr-only">{t('etl.editStep')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSave(p);
          }}
        >
          {fields}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={!valid}>
              {t('transform.editor.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

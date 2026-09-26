'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/useT';
import { defaultSheets, type PreparedFile } from '@/lib/workspace/importer';
import { useImportStore } from '@/store/import';
import { useImport } from './useImport';

/** Asks which sheets to import (default: all visible, non-empty sheets) (7.2). */
export function SheetPicker() {
  const picking = useImportStore((s) => s.picking);
  if (!picking?.length) return null;
  return <SheetPickerDialog key={picking.map((p) => p.key).join()} files={picking} />;
}

function SheetPickerDialog({ files }: { files: PreparedFile[] }) {
  const t = useT();
  const { finish } = useImport();
  const others = useImportStore((s) => s.others);
  const [choice, setChoice] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(files.map((f) => [f.key, defaultSheets(f.sheets ?? [])])),
  );
  const total = Object.values(choice).reduce((n, s) => n + s.length, 0);
  const toggle = (key: string, sheet: string, on: boolean) =>
    setChoice((c) => ({ ...c, [key]: on ? [...(c[key] ?? []), sheet] : (c[key] ?? []).filter((s) => s !== sheet) }));
  const close = () => useImportStore.getState().set({ picking: null, others: [] });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('sources.sheetPicker.title')}</DialogTitle>
          {files.length === 1 && (
            <DialogDescription>
              {t('sources.sheetPicker.description', { file: files[0].file.name, count: files[0].sheets?.length ?? 0 })}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {files.map((f) => (
            <fieldset key={f.key} className="flex flex-col gap-2">
              {files.length > 1 && <legend className="mb-1 font-semibold">{f.file.name}</legend>}
              {(f.sheets ?? []).map((sheet) => {
                const id = `${f.key}-${sheet.name}`;
                return (
                  <label key={id} htmlFor={id} className="nm-flat flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5">
                    <Checkbox
                      id={id}
                      checked={choice[f.key]?.includes(sheet.name) ?? false}
                      onCheckedChange={(v) => toggle(f.key, sheet.name, v === true)}
                    />
                    <span className="flex-1 font-medium">{sheet.name}</span>
                    {sheet.hidden && <Badge variant="muted">{t('sources.sheetPicker.hidden')}</Badge>}
                    {sheet.empty ? (
                      <Badge variant="muted">{t('sources.sheetPicker.empty')}</Badge>
                    ) : (
                      <span className="tabular text-[13px] text-fg-2">{t('sources.sheetPicker.rows', { count: sheet.rows })}</span>
                    )}
                  </label>
                );
              })}
            </fieldset>
          ))}
          {total === 0 && <p className="text-[13px] text-danger">{t('sources.sheetPicker.noneSelected')}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={total === 0} onClick={() => void finish([...files, ...others], choice)}>
            {t('sources.sheetPicker.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

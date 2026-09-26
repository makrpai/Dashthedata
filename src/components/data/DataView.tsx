'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { DropZone } from '@/components/sources/DropZone';
import { SourceList } from '@/components/sources/SourceList';
import { useImport } from '@/components/sources/useImport';
import { DataPreview, type PreviewColumn } from '@/components/transform/DataPreview';
import { ViewHeader } from '@/components/views/ViewHeader';
import { useT } from '@/lib/i18n/useT';
import { useProjectStore } from '@/store';
import { useImportStore } from '@/store/import';
import { EMPTY } from '@/lib/util/empty';

export function DataView() {
  const t = useT();
  const { importFiles } = useImport();
  const sources = useProjectStore((s) => s.project?.sources ?? EMPTY);
  const datasets = useProjectStore((s) => s.project?.datasets ?? EMPTY);
  const engine = useProjectStore((s) => s.engine);
  const lastImported = useImportStore((s) => s.lastImported);
  // The user's pick is reset whenever a new import lands, so the newest data is shown.
  const [pick, setPick] = useState<{ id: string; forImport: string[] } | null>(null);
  const importedSource = datasets.find((d) => d.id === lastImported[0])?.sourceIds[0];
  const selected =
    pick && pick.forImport === lastImported ? pick.id : (importedSource ?? sources[0]?.id ?? null);
  const setSelected = (id: string) => setPick({ id, forImport: lastImported });

  const source = sources.find((s) => s.id === selected) ?? null;
  const dataset = source ? datasets.find((d) => d.kind === 'source' && d.sourceIds.includes(source.id)) : undefined;
  const columns: PreviewColumn[] = [];
  if (source) {
    const width = source.columnNames?.length ?? dataset?.columns.length ?? 0;
    for (let i = 0; i < width; i++) {
      columns.push({ name: `c${i}`, label: source.columnNames?.[i] ?? t('preview.column', { n: i + 1 }) });
    }
  }

  return (
    <>
      <ViewHeader title={t('views.data.title')} description={sources.length === 0 ? t('views.data.empty') : undefined} />
      <div className="flex flex-col gap-6">
        <DropZone onFiles={(files) => void importFiles(files)} compact={sources.length > 0} />
        {engine === 'loading' && (
          <p className="flex items-center gap-2 text-fg-2" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('sources.engine.loading')}
          </p>
        )}
        {engine === 'error' && <p className="text-danger">{t('sources.engine.error')}</p>}
        {sources.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[17.5px] font-bold">{t('sources.list.title')}</h2>
            <SourceList selectedId={selected} onSelect={setSelected} />
          </section>
        )}
        {source && columns.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[17.5px] font-bold">{t('preview.title', { name: source.name })}</h2>
            <p className="text-[13px] text-fg-2">
              {t('preview.summary', {
                rows: t('common.rows', { count: source.rowCount }),
                columns: t('common.columns', { count: columns.length }),
              })}
            </p>
            <Card surface="flat" className="p-0">
              <DataPreview
                label={t('preview.title', { name: source.name })}
                table={source.rawTable}
                columns={columns}
                rowCount={source.rowCount}
                version={source.lastLoadedAt ?? source.id}
                className="h-[480px] border-0"
              />
            </Card>
          </section>
        )}
      </div>
    </>
  );
}

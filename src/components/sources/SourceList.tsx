'use client';

import Link from 'next/link';
import { Eye, FileSpreadsheet, FileJson, FileText, Database, Globe, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Tooltip } from '@/components/ui/tooltip';
import { formatBytes } from '@/lib/ingest';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';
import { removeSourceAndTables } from '@/lib/workspace/sources';
import { useProjectStore } from '@/store';
import type { Source } from '@/types/domain';
import { EMPTY } from '@/lib/util/empty';

function SourceIcon({ source }: { source: Source }) {
  const cls = 'size-5 text-slate';
  if (source.kind === 'http') return <Globe className={cls} aria-hidden />;
  if (source.kind !== 'file') return <Database className={cls} aria-hidden />;
  const f = source.file?.format;
  if (f === 'xlsx' || f === 'xls') return <FileSpreadsheet className={cls} aria-hidden />;
  if (f === 'json') return <FileJson className={cls} aria-hidden />;
  return <FileText className={cls} aria-hidden />;
}

const delimiterLabel = (d?: string) => (d === '\t' ? 'Tab' : d);

export function SourceList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (sourceId: string) => void }) {
  const t = useT();
  const sources = useProjectStore((s) => s.project?.sources ?? EMPTY);
  const datasets = useProjectStore((s) => s.project?.datasets ?? EMPTY);
  const busy = useProjectStore((s) => s.busyDatasets);
  const [removing, setRemoving] = useState<Source | null>(null);
  const time = new Intl.DateTimeFormat(t.locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('sources.list.title')}>
        {sources.map((source) => {
          const dataset = datasets.find((d) => d.kind === 'source' && d.sourceIds.includes(source.id));
          const isBusy = dataset ? busy.includes(dataset.id) : false;
          const selected = selectedId === source.id;
          return (
            <li key={source.id}>
              <Card className={cn('flex h-full flex-col gap-3 p-4', selected && 'outline-2 outline-offset-2 outline-accent')}>
                <div className="flex items-start gap-3">
                  <SourceIcon source={source} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold" title={source.name}>
                      {source.name}
                    </h3>
                    <p className="text-[12px] text-fg-2">
                      {source.lastLoadedAt && t('sources.list.loadedAt', { time: time.format(new Date(source.lastLoadedAt)) })}
                    </p>
                  </div>
                  {source.file && <Badge variant="muted">{source.file.format.toUpperCase()}</Badge>}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                  <dt className="text-fg-2">{t('sources.list.rows')}</dt>
                  <dd className="tabular text-right font-semibold">{new Intl.NumberFormat(t.locale).format(dataset?.rowCount ?? source.rowCount)}</dd>
                  {source.file && (
                    <>
                      <dt className="text-fg-2">{t('sources.list.size')}</dt>
                      <dd className="tabular text-right">{formatBytes(source.file.size, t.locale)}</dd>
                    </>
                  )}
                  {source.file?.encoding && (
                    <>
                      <dt className="text-fg-2">{t('sources.list.encoding')}</dt>
                      <dd className="text-right">{source.file.encoding}</dd>
                    </>
                  )}
                  {source.file?.delimiter && (
                    <>
                      <dt className="text-fg-2">{t('sources.list.delimiter')}</dt>
                      <dd className="text-right font-mono">{delimiterLabel(source.file.delimiter)}</dd>
                    </>
                  )}
                </dl>
                {source.warnings?.map((w) => (
                  <p key={w.key} className="text-[12px] text-fg-2">
                    {t.dynamic(w.key, w.params)}
                  </p>
                ))}
                <div className="mt-auto flex items-center gap-2 pt-1">
                  {isBusy ? (
                    <span className="flex items-center gap-2 text-[13px] text-fg-2" role="status">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      {t('sources.list.busy')}
                    </span>
                  ) : (
                    <>
                      <Button size="sm" variant={selected ? 'primary' : 'soft'} onClick={() => onSelect(source.id)} aria-pressed={selected}>
                        <Eye aria-hidden />
                        {t('sources.list.preview')}
                      </Button>
                      {dataset && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/workspace/transform/${dataset.id}`}>
                            <Sparkles aria-hidden />
                            {t('sources.list.openCleanup')}
                          </Link>
                        </Button>
                      )}
                    </>
                  )}
                  <Tooltip content={t('sources.list.remove')}>
                    <Button size="iconSm" variant="ghost" className="ml-auto" aria-label={`${t('sources.list.remove')}: ${source.name}`} onClick={() => setRemoving(source)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </Tooltip>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('sources.list.remove')}</DialogTitle>
            <DialogDescription>{removing && t('sources.list.removeConfirm', { name: removing.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (removing) void removeSourceAndTables(removing.id).then(() => toast.success(t('sources.list.removed')));
                setRemoving(null);
              }}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

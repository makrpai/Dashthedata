'use client';

import { FileUp, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';
import { useImportStore } from '@/store/import';
import { SampleMenu } from './SampleMenu';

const ACCEPT = '.xlsx,.xlsm,.xls,.csv,.tsv,.txt,.json,.parquet';

/**
 * Inset drop area. Dragging files anywhere over the window shows a full-screen overlay (phase 1:
 * "vetäminen koko ikkunaan").
 */
export function DropZone({
  onFiles,
  compact = false,
  className,
  withSamples = true,
}: {
  onFiles: (files: File[]) => void;
  compact?: boolean;
  className?: string;
  withSamples?: boolean;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const busy = useImportStore((s) => s.busy);
  const progress = useImportStore((s) => s.progress);
  const [windowDrag, setWindowDrag] = useState(false);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setWindowDrag(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setWindowDrag(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setWindowDrag(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onFiles(files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [onFiles]);

  return (
    <>
      <div
        className={cn(
          'nm-inset flex flex-col items-center justify-center gap-3 rounded-[24px] px-6 text-center',
          compact ? 'py-6' : 'py-10',
          className,
        )}
      >
        {busy ? (
          <Loader2 className="size-7 animate-spin text-slate" aria-hidden />
        ) : (
          <FileUp className="size-7 text-slate" aria-hidden />
        )}
        <p className="text-[16px] font-semibold">{t('sources.drop.title')}</p>
        <p className="text-[13px] text-fg-2" role="status" aria-live="polite">
          {progress ?? `${t('sources.drop.formats')} · ${t('sources.drop.privacy')}`}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {withSamples && <SampleMenu />}
          <Button variant={withSamples ? 'soft' : 'primary'} disabled={busy} onClick={() => input.current?.click()}>
            {t('sources.drop.browse')}
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="file-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) onFiles(files);
          }}
        />
      </div>
      {windowDrag && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--base)_85%,transparent)]">
          <div className="nm-inset flex flex-col items-center gap-3 rounded-[24px] border-2 border-dashed border-accent px-16 py-14">
            <FileUp className="size-9 text-accent" aria-hidden />
            <p className="text-[17.5px] font-bold">{t('sources.drop.release')}</p>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect } from 'react';
import { useImportStore } from '@/store/import';
import { SheetPicker } from './SheetPicker';
import { useImport } from './useImport';

/** Mounted once in the workspace: picks up files queued on another page and shows the sheet picker. */
export function ImportController() {
  const { importFiles } = useImport();
  const queued = useImportStore((s) => s.queued.length);
  useEffect(() => {
    if (queued === 0) return;
    const files = useImportStore.getState().takeQueued();
    void importFiles(files);
  }, [queued, importFiles]);
  return <SheetPicker />;
}

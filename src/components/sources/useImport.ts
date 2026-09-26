'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { formatBytes } from '@/lib/ingest';
import { useT } from '@/lib/i18n/useT';
import { fetchSample, importPrepared, prepareFiles, type ImportIssue, type PreparedFile } from '@/lib/workspace/importer';
import { createAutoDashboard } from '@/lib/workspace/suggestions';
import { useProjectStore } from '@/store';
import { useImportStore } from '@/store/import';

/** Import flow shared by the drop zone, file picker, samples and the landing page. */
export function useImport() {
  const t = useT();
  const router = useRouter();

  const report = useCallback(
    (issues: ImportIssue[]) => {
      for (const issue of issues) {
        const params =
          issue.key === 'errors.fileTooLarge' && issue.params
            ? { size: formatBytes(Number(issue.params.size), t.locale), max: formatBytes(Number(issue.params.max), t.locale) }
            : issue.params;
        toast.error(issue.fileName, { description: t.dynamic(issue.key, params) });
      }
    },
    [t],
  );

  const finish = useCallback(
    async (prepared: PreparedFile[], sheetChoice: Record<string, string[]>) => {
      const openCleanup = useImportStore.getState().openCleanup;
      const store = useImportStore.getState();
      store.set({ busy: true, picking: null, others: [] });
      try {
        const projectName = prepared[0]?.file.name.replace(/\.[^.]+$/, '') ?? t('project.untitled');
        store.set({ progress: t('sources.importing', { name: prepared.map((p) => p.file.name).join(', ') }) });
        const { datasetIds, issues, cleaned } = await importPrepared(prepared, sheetChoice, projectName);
        report(issues);
        if (datasetIds.length) {
          toast.success(t('sources.imported', { count: datasetIds.length }), {
            description: cleaned > 0 ? t('etl.summaryToast', { count: cleaned }) : undefined,
          });
        }
        store.set({ lastImported: datasetIds });
        // First import: build the dashboard right away (12.6) and show what was cleaned (2.1).
        const hasTiles = useProjectStore.getState().project?.dashboards.some((d) => d.tiles.length > 0);
        if (datasetIds.length && !hasTiles) {
          await createAutoDashboard(t('views.dashboards.title')).catch(() => null);
          if (openCleanup) router.push(`/workspace/transform/${datasetIds[0]}`);
        }
        return datasetIds;
      } catch (err) {
        toast.error(t('sources.engine.error'), { description: err instanceof Error ? err.message : undefined });
        return [];
      } finally {
        useImportStore.getState().set({ busy: false, progress: null });
      }
    },
    [report, router, t],
  );

  const importFiles = useCallback(
    async (files: File[], opts: { openCleanup?: boolean } = {}) => {
      if (!files.length) return;
      const store = useImportStore.getState();
      store.set({ openCleanup: Boolean(opts.openCleanup) });
      store.set({ busy: true, progress: t('sources.importing', { name: files.map((f) => f.name).join(', ') }) });
      const { prepared, issues } = await prepareFiles(files);
      report(issues);
      const needsPicker = prepared.filter((p) => p.sheets && p.sheets.length > 1);
      if (needsPicker.length) {
        store.set({ picking: needsPicker, others: prepared.filter((p) => !needsPicker.includes(p)), busy: false, progress: null });
        return;
      }
      await finish(prepared, {});
    },
    [finish, report, t],
  );

  const importSample = useCallback(
    async (names: string[]) => {
      useImportStore.getState().set({ busy: true });
      const files = await Promise.all(names.map(fetchSample));
      await importFiles(files, { openCleanup: true });
    },
    [importFiles],
  );

  /** Hands files over to the workspace (used from the landing page). */
  const queueAndOpen = useCallback(
    (files: File[]) => {
      useImportStore.getState().queue(files);
      router.push('/workspace/data');
    },
    [router],
  );

  return { importFiles, importSample, finish, queueAndOpen };
}

/** Sample files (21). The first matches the UI language. */
export const SAMPLES = [
  { id: 'myynti', files: ['myynti-2025.xlsx'], key: 'sources.samples.myynti' },
  { id: 'salesOrders', files: ['sales-orders.csv'], key: 'sources.samples.salesOrders' },
  { id: 'quarters', files: ['tilaukset-q1.csv', 'tilaukset-q2.csv'], key: 'sources.samples.quarters' },
  { id: 'relation', files: ['asiakkaat.csv', 'tilaukset.csv'], key: 'sources.samples.relation' },
  { id: 'products', files: ['tuotteet.json'], key: 'sources.samples.products' },
] as const;

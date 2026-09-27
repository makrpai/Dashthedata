'use client';

import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';
import { downloadBlob, downloadDataUrl, safeFileName } from '@/lib/export/csv';
import { useT } from '@/lib/i18n/useT';
import { quoteIdent } from '@/lib/duckdb/sql';
import { ensureEngine } from '@/lib/workspace/engine';
import type { ChartSpec, Dashboard, Dataset } from '@/types/domain';

function canvasSelector(dashboardId: string) {
  return `[data-dashboard-canvas="${dashboardId}"]`;
}

function exportName(name: string, ext: string) {
  return `${safeFileName(name)}.${ext}`;
}

export function DashboardExportMenu({
  dashboard,
  datasets,
  charts,
}: {
  dashboard: Dashboard;
  datasets: Dataset[];
  charts: ChartSpec[];
}) {
  const t = useT();
  const usedDatasetIds = new Set(
    dashboard.tiles
      .map((tile) => charts.find((chart) => chart.id === tile.chartId)?.datasetId)
      .filter((id): id is string => Boolean(id)),
  );
  const usedDatasets = datasets.filter((dataset) => usedDatasetIds.has(dataset.id));
  const exportPng = async () => {
    try {
      const node = document.querySelector(canvasSelector(dashboard.id)) as HTMLElement | null;
      if (!node) return;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor:
          getComputedStyle(document.documentElement).getPropertyValue('--base').trim() || '#ffffff',
      });
      downloadDataUrl(dataUrl, exportName(dashboard.name, 'png'));
    } catch {
      toast.error(t('topbar.exportFailed'));
    }
  };
  const exportPdf = async () => {
    try {
      const node = document.querySelector(canvasSelector(dashboard.id)) as HTMLElement | null;
      if (!node) return;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor:
          getComputedStyle(document.documentElement).getPropertyValue('--base').trim() || '#ffffff',
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      const now = new Date().toLocaleString(t.locale);
      pdf.setFontSize(14);
      pdf.text(dashboard.name, 10, 10);
      pdf.setFontSize(10);
      pdf.text(now, 10, 16);
      const filters = dashboard.globalFilters.filter((f) => f.value !== undefined).length + (dashboard.crossFilter ? 1 : 0);
      pdf.text(`${t('chart.editor.filters')}: ${filters}`, 10, 22);
      pdf.addImage(dataUrl, 'PNG', 10, 26, width - 20, height - 36, undefined, 'FAST');
      downloadBlob(pdf.output('arraybuffer'), exportName(dashboard.name, 'pdf'), 'application/pdf');
    } catch {
      toast.error(t('topbar.exportFailed'));
    }
  };
  const exportDataset = async (dataset: Dataset, format: 'csv' | 'parquet') => {
    try {
      const runner = await ensureEngine();
      const sql = `SELECT * FROM ${quoteIdent(dataset.outputTable)}`;
      const bytes =
        format === 'csv'
          ? await runner.copyToBuffer(sql, 'csv', "HEADER, DELIMITER ','")
          : await runner.copyToBuffer(sql, 'parquet');
      downloadBlob(
        new Uint8Array(bytes).buffer,
        exportName(dataset.name, format === 'csv' ? 'csv' : 'parquet'),
        format === 'csv' ? 'text/csv;charset=utf-8' : 'application/octet-stream',
      );
    } catch {
      toast.error(t('topbar.exportFailed'));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="soft">
          <Download aria-hidden />
          {t('topbar.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => void exportPng()}>{t('topbar.exportPng')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportPdf()}>{t('topbar.exportPdf')}</DropdownMenuItem>
        {usedDatasets.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('topbar.exportData')}</DropdownMenuLabel>
            {usedDatasets.map((dataset) => (
              <DropdownMenuSub key={dataset.id}>
                <DropdownMenuSubTrigger>{dataset.name}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => void exportDataset(dataset, 'csv')}>
                    {t('topbar.exportCsv')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportDataset(dataset, 'parquet')}>
                    {t('topbar.exportParquet')}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

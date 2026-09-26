/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import { ExcelError, listSheets, readWorkbook, sheetToMatrix, type XlsxLike } from './excel';

export type ExcelRequest =
  | { type: 'open'; id: number; buffer: ArrayBuffer }
  | { type: 'read'; id: number; workbookId: number; sheet: string }
  | { type: 'close'; id: number; workbookId: number };

export type ExcelResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; code: string; message: string };

const workbooks = new Map<number, WorkBook>();
let nextWorkbookId = 1;
const xlsx = XLSX as unknown as XlsxLike;

self.onmessage = (event: MessageEvent<ExcelRequest>) => {
  const msg = event.data;
  const reply = (r: ExcelResponse) => (self as unknown as Worker).postMessage(r);
  try {
    if (msg.type === 'open') {
      const wb = readWorkbook(xlsx, new Uint8Array(msg.buffer));
      const workbookId = nextWorkbookId++;
      workbooks.set(workbookId, wb);
      reply({ id: msg.id, ok: true, result: { workbookId, sheets: listSheets(xlsx, wb) } });
    } else if (msg.type === 'read') {
      const wb = workbooks.get(msg.workbookId);
      if (!wb) throw new ExcelError('unreadable');
      reply({ id: msg.id, ok: true, result: sheetToMatrix(xlsx, wb, msg.sheet) });
    } else if (msg.type === 'close') {
      workbooks.delete(msg.workbookId);
      reply({ id: msg.id, ok: true, result: null });
    }
  } catch (err) {
    const code = err instanceof ExcelError ? err.code : 'unreadable';
    reply({ id: msg.id, ok: false, code, message: err instanceof Error ? err.message : String(err) });
  }
};

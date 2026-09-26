'use client';

import type { SheetInfo, SheetMatrix } from './excel';
import { ExcelError } from './excel';
import type { ExcelRequest, ExcelResponse } from './excel.worker';

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };

let worker: Worker | null = null;
const pending = new Map<number, Pending>();
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ExcelResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new ExcelError(e.data.code === 'passwordProtected' ? 'passwordProtected' : 'unreadable'));
    };
  }
  return worker;
}

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

function call<T>(msg: WithoutId<ExcelRequest>, transfer: Transferable[] = []): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker().postMessage({ ...msg, id }, transfer);
  });
}

/** Parses a workbook in the SheetJS worker and returns its sheets (7.2). */
export async function openWorkbook(bytes: ArrayBuffer): Promise<{ workbookId: number; sheets: SheetInfo[] }> {
  const copy = bytes.slice(0);
  return call({ type: 'open', buffer: copy }, [copy]);
}

export function readSheet(workbookId: number, sheet: string): Promise<SheetMatrix> {
  return call({ type: 'read', workbookId, sheet });
}

export function closeWorkbook(workbookId: number): Promise<void> {
  return call({ type: 'close', workbookId });
}

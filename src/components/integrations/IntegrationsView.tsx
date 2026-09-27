'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { ViewHeader } from '@/components/views/ViewHeader';
import { rowsFromJson } from '@/lib/connectors/http';
import { useT } from '@/lib/i18n/useT';
import { importRemoteCsv, importRemoteTable } from '@/lib/workspace/remoteImport';

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `HTTP ${res.status}`;
}

export function IntegrationsView() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [pg, setPg] = useState({ host: 'localhost', port: '5432', database: 'dash', user: 'dash', password: 'dash', sql: 'SELECT 1 AS n' });
  const [my, setMy] = useState({ host: 'localhost', port: '3306', database: 'dash', user: 'dash', password: 'dash', sql: 'SELECT 1 AS n' });
  const [url, setUrl] = useState('https://');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(t('integrations.imported'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('integrations.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ViewHeader title={t('views.integrations.title')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t('integrations.postgres')}</h2>
          <Input aria-label={t('integrations.host')} value={pg.host} onChange={(e) => setPg({ ...pg, host: e.target.value })} />
          <Input aria-label={t('integrations.database')} value={pg.database} onChange={(e) => setPg({ ...pg, database: e.target.value })} />
          <Input aria-label={t('integrations.user')} value={pg.user} onChange={(e) => setPg({ ...pg, user: e.target.value })} />
          <Input aria-label={t('integrations.password')} type="password" value={pg.password} onChange={(e) => setPg({ ...pg, password: e.target.value })} />
          <Input aria-label="SQL" value={pg.sql} onChange={(e) => setPg({ ...pg, sql: e.target.value })} />
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await fetch('/api/connectors/postgres', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ ...pg, port: Number(pg.port), ssl: false }),
                });
                if (!res.ok) throw new Error(await readError(res));
                const table = (await res.json()) as { headers: string[]; rows: string[][] };
                await importRemoteTable({
                  name: pg.database,
                  kind: 'postgres',
                  headers: table.headers,
                  rows: table.rows,
                  db: { host: pg.host, port: Number(pg.port), database: pg.database, user: pg.user, ssl: 'disable', query: { mode: 'sql', sql: pg.sql }, rowLimit: 5000 },
                });
              })
            }
          >
            {t('integrations.connect')}
          </Button>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t('integrations.mysql')}</h2>
          <Input aria-label={t('integrations.host')} value={my.host} onChange={(e) => setMy({ ...my, host: e.target.value })} />
          <Input aria-label={t('integrations.database')} value={my.database} onChange={(e) => setMy({ ...my, database: e.target.value })} />
          <Input aria-label={t('integrations.user')} value={my.user} onChange={(e) => setMy({ ...my, user: e.target.value })} />
          <Input aria-label={t('integrations.password')} type="password" value={my.password} onChange={(e) => setMy({ ...my, password: e.target.value })} />
          <Input aria-label="SQL" value={my.sql} onChange={(e) => setMy({ ...my, sql: e.target.value })} />
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await fetch('/api/connectors/mysql', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ ...my, port: Number(my.port) }),
                });
                if (!res.ok) throw new Error(await readError(res));
                const table = (await res.json()) as { headers: string[]; rows: string[][] };
                await importRemoteTable({
                  name: my.database,
                  kind: 'mysql',
                  headers: table.headers,
                  rows: table.rows,
                  db: { host: my.host, port: Number(my.port), database: my.database, user: my.user, ssl: 'disable', query: { mode: 'sql', sql: my.sql }, rowLimit: 5000 },
                });
              })
            }
          >
            {t('integrations.connect')}
          </Button>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t('integrations.http')}</h2>
          <p className="text-[13px] text-fg-2">{t('integrations.sheetsHint')}</p>
          <Input aria-label="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await fetch('/api/connectors/http', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
                if (!res.ok) throw new Error(await readError(res));
                const body = (await res.json()) as { format: 'csv'; text: string } | { format: 'json'; headers: string[]; rows: string[][] };
                if (body.format === 'csv') await importRemoteCsv({ name: 'HTTP', text: body.text, http: { url, format: 'csv' } });
                else await importRemoteTable({ name: 'HTTP', kind: 'http', headers: body.headers, rows: body.rows, http: { url, format: 'json' } });
              })
            }
          >
            {t('integrations.connect')}
          </Button>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t('integrations.demo')}</h2>
          <p className="text-[13px] text-fg-2">{t('integrations.demoHint')}</p>
          <Button
            variant="soft"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await fetch('/api/demo/orders');
                if (!res.ok) throw new Error(await readError(res));
                const table = rowsFromJson(await res.json());
                await importRemoteTable({ name: t('integrations.demo'), kind: 'http', headers: table.headers, rows: table.rows, http: { url: '/api/demo/orders', format: 'json' } });
              })
            }
          >
            {t('integrations.loadDemo')}
          </Button>
        </Card>
      </div>
    </>
  );
}

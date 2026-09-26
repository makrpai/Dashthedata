/**
 * Generates the sample files (public/samples) and test fixtures (tests/fixtures).
 * Deterministic: `npm run samples` always produces the same bytes. Pass --large to also write a
 * 1 million row CSV (not committed) for performance testing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { encodeWindows1252 } from '../src/lib/ingest/encoding';
import { Rng, toCsv } from './lib/random';
import { customersSheet, messySales, productsJson, quarterOrders, relationSample, salesOrders } from './lib/samples';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const samplesDir = join(root, 'public/samples');
const fixturesDir = join(root, 'tests/fixtures');

function write(dir: string, name: string, content: string | Uint8Array) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content);
  console.log(`[samples] ${join(dir, name).replace(root + '/', '')}`);
}

/** Fixed timestamps keep xlsx output byte-stable. */
function xlsxBytes(wb: XLSX.WorkBook): Uint8Array {
  wb.Props = { Title: 'Dash the Data sample', Author: 'Dash the Data', CreatedDate: new Date(Date.UTC(2026, 0, 3)) };
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer);
}

function withDateFormat(ws: XLSX.WorkSheet, col: number, format = 'd.m.yyyy') {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
    if (cell && cell.t === 'n') cell.z = format;
  }
}

// ---------- 21.1 myynti-2025.xlsx ----------
function myynti(): Uint8Array {
  const sales = messySales(new Rng(2025));
  const wsSales = XLSX.utils.aoa_to_sheet(sales.sheet);
  wsSales['!merges'] = sales.merges;
  const wsCustomers = XLSX.utils.aoa_to_sheet(customersSheet(new Rng(2026)));
  withDateFormat(wsCustomers, 3);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSales, 'Myynti 2025');
  XLSX.utils.book_append_sheet(wb, wsCustomers, 'Asiakkaat');
  return xlsxBytes(wb);
}

// ---------- fixture 7: wide-quarters.xlsx ----------
function wideQuarters(): Uint8Array {
  const rng = new Rng(77);
  const rows: Array<Array<string | number | null>> = [['Tuote', 'Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Yhteensä']];
  for (const p of ['Kengät', 'Takit', 'Pipot', 'Reput', 'Hanskat']) {
    const q = [0, 1, 2, 3].map(() => rng.int(1000, 9000));
    rows.push([p, ...q, q.reduce((a, b) => a + b, 0)]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Kvartaalit');
  return xlsxBytes(wb);
}

const myyntiBytes = myynti();
write(samplesDir, 'myynti-2025.xlsx', myyntiBytes);
write(samplesDir, 'sales-orders.csv', toCsv(salesOrders(new Rng(2025))));
write(samplesDir, 'tilaukset-q1.csv', encodeWindows1252(toCsv(quarterOrders(1), ';')));
write(samplesDir, 'tilaukset-q2.csv', encodeWindows1252(toCsv(quarterOrders(2), ';')));
const rel = relationSample(new Rng(2027));
write(samplesDir, 'asiakkaat.csv', toCsv(rel.customers));
write(samplesDir, 'tilaukset.csv', toCsv(rel.orders));
write(samplesDir, 'tuotteet.json', JSON.stringify(productsJson(new Rng(2028)), null, 2) + '\n');

// ---------- test fixtures (20.2) ----------
write(fixturesDir, 'fi-sales-messy.xlsx', myyntiBytes);
write(
  fixturesDir,
  'header-offset.csv',
  toCsv([
    ['Kuukausiraportti'],
    ['Laadittu 2.1.2026'],
    [],
    ['Tuote', 'Kpl', 'Summa'],
    ['Kengät', 12, '1 204,50'],
    ['Takit', 4, '980,00'],
    ['Pipot', 30, '450,00'],
    ['Hanskat', 9, '219,90'],
  ], ';'),
);
write(
  fixturesDir,
  'win1252-semicolon.csv',
  encodeWindows1252(
    toCsv([
      ['Kaupunki', 'Myyjä', 'Myynti €', 'Päivä'],
      ['Hämeenlinna', 'Äijälä', '1 234,56', '31.12.2025'],
      ['Jyväskylä', 'Öhman', '987,10', '1.1.2025'],
      ['Mäntsälä', 'Kärkkäinen', '-12,50', '15.6.2025'],
    ], ';'),
  ),
);
write(
  fixturesDir,
  'us-format.csv',
  toCsv([
    ['Customer', 'Amount', 'Date'],
    ['Acme', '1,234.56', '12/31/2025'],
    ['Globex', '987.10', '1/15/2025'],
    ['Initech', '12,000.00', '6/30/2025'],
  ]),
);
write(
  fixturesDir,
  'ambiguous-dates.csv',
  toCsv([
    ['Tapahtuma', 'Pvm'],
    ['A', '01/02/2025'],
    ['B', '03/04/2025'],
    ['C', '05/06/2025'],
    ['D', '07/08/2025'],
  ]),
);
write(
  fixturesDir,
  'leading-zeros.csv',
  toCsv([
    ['Asiakasnumero', 'Postinumero', 'Määrä'],
    ['000123', '00100', '5'],
    ['000456', '02100', '7'],
    ['001789', '33100', '1'],
    ['004012', '90100', '12'],
  ]),
);
write(fixturesDir, 'wide-quarters.xlsx', wideQuarters());
write(fixturesDir, 'nested.json', JSON.stringify(productsJson(new Rng(5)).slice(0, 12), null, 2) + '\n');
write(
  fixturesDir,
  'columnar.json',
  JSON.stringify(
    {
      latitude: 60.17,
      longitude: 24.94,
      daily_units: { time: 'iso8601', temperature_2m_max: '°C' },
      daily: {
        time: Array.from({ length: 14 }, (_, i) => `2025-01-${String(i + 1).padStart(2, '0')}`),
        temperature_2m_max: [-1.5, 0.3, 1.2, -3.4, -6.1, -2.2, 0.0, 1.5, 2.1, -0.4, -4.8, -7.9, -5.5, -1.1],
        precipitation_sum: [0.2, 1.4, 3.1, 0, 0, 0.6, 2.2, 5.4, 0.1, 0, 0, 0.3, 1.9, 0.8],
      },
    },
    null,
    2,
  ) + '\n',
);
write(
  fixturesDir,
  'union-a.csv',
  toCsv([
    ['Tuote', 'Määrä', 'Hinta'],
    ['Kengät', '2', '89,90'],
    ['Takki', '1', '179,00'],
  ], ';'),
);
write(
  fixturesDir,
  'union-b.csv',
  toCsv([
    ['Hinta', 'Tuote', 'Määrä'],
    ['29,90', 'Pipo', '3'],
    ['45,00', 'Vyö', '1'],
    ['89,90', 'Kengät', '1'],
  ], ';'),
);
const relSmall = relationSample(new Rng(99));
write(fixturesDir, 'customers.csv', toCsv(relSmall.customers.slice(0, 61)));
write(
  fixturesDir,
  'orders.csv',
  toCsv([relSmall.orders[0], ...relSmall.orders.slice(1, 301).map((r) => [r[0], String(((Number(r[1]) - 1) % 64) + 1), r[2], r[3]])]),
);
write(
  fixturesDir,
  'no-header.csv',
  toCsv(Array.from({ length: 20 }, (_, i) => [i + 1, (i * 7) % 13, ((i * 31) % 97) / 10])),
);
write(
  fixturesDir,
  'totals-false-positive.csv',
  toCsv([
    ['Tuote', 'Määrä', 'Hinta'],
    ['Yhteensä-paketti', '3', '49,00'],
    ['Kengät', '2', '89,90'],
    ['Takki', '1', '179,00'],
    ['Pipo', '5', '19,90'],
  ], ';'),
);

if (process.argv.includes('--large')) {
  const rng = new Rng(1);
  const lines = ['id,date,region,product,quantity,amount'];
  for (let i = 1; i <= 1_000_000; i++) {
    const m = rng.int(1, 12);
    lines.push(`${i},2025-${String(m).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')},${rng.pick(['North', 'South', 'East', 'West'])},P${rng.int(1, 200)},${rng.int(1, 9)},${(rng.float() * 500).toFixed(2)}`);
  }
  write(join(root, 'tmp'), 'large-1m.csv', lines.join('\n') + '\n');
}

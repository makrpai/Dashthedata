/**
 * Sample data (plan section 21). Pure functions; scripts/generate-samples.ts writes the files and
 * scripts/seed-demo-db.ts reuses the order data.
 */
import { Rng, daysInMonth, excelSerial, fiDate, fiNumber, isoDate, pad } from './random';

export const REGIONS = ['Helsinki', 'Espoo', 'Tampere', 'Turku', 'Oulu', 'Jyväskylä'] as const;
export const PRODUCT_GROUPS = ['Kengät', 'Takit', 'Asusteet', 'Urheilu'] as const;
export const MONTHS_FI = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];

const REGION_SIZE: Record<string, number> = {
  Helsinki: 1.9,
  Espoo: 1.35,
  Tampere: 1.2,
  Turku: 1.0,
  Jyväskylä: 0.8,
  Oulu: 0.62,
};
const GROUP_BASE: Record<string, number> = { Kengät: 14200, Takit: 11800, Asusteet: 6400, Urheilu: 9100 };

function seasonal(group: string, month: number): number {
  if (group === 'Takit') return [1.15, 0.95, 0.8, 0.7, 0.55, 0.45, 0.45, 0.6, 0.95, 1.45, 1.7, 1.9][month - 1];
  if (group === 'Urheilu') return [0.8, 0.85, 0.95, 1.1, 1.45, 1.7, 1.55, 1.1, 0.95, 0.8, 0.75, 0.9][month - 1];
  if (group === 'Kengät') return [0.9, 0.85, 1.0, 1.05, 1.1, 1.0, 0.95, 1.1, 1.15, 1.0, 0.95, 1.25][month - 1];
  return [0.85, 0.8, 0.9, 0.95, 1.0, 1.05, 1.0, 0.95, 1.0, 1.05, 1.15, 1.6][month - 1];
}

export interface MessySales {
  /** Sheet "Myynti 2025" as an array of arrays (strings, numbers, nulls). */
  sheet: Array<Array<string | number | null>>;
  merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  /** Clean values: region, group, month (1–12), value. */
  clean: Array<{ region: string; group: string; month: number; value: number }>;
}

/** Sheet "Myynti 2025" with every mess listed in 21.1. */
export function messySales(rng = new Rng(2025)): MessySales {
  const sheet: MessySales['sheet'] = [];
  const merges: MessySales['merges'] = [];
  const clean: MessySales['clean'] = [];
  sheet.push(['Myyntiraportti 2025 – Oy Esimerkki Ab', ...Array(15).fill(null)]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } });
  sheet.push(['Tulostettu 3.1.2026', ...Array(15).fill(null)]);
  sheet.push(Array(16).fill(null));
  sheet.push(['Alue', 'Tuoteryhmä', ...MONTHS_FI, null, 'Yhteensä']);

  const totals = Array(12).fill(0);
  let grand = 0;
  const textCells = new Set<string>();
  const emptyCells = new Set(['Espoo|Asusteet|3', 'Oulu|Kengät|9']);
  let rowIndex = 4;
  for (const region of REGIONS) {
    const groupStart = rowIndex;
    PRODUCT_GROUPS.forEach((group, gi) => {
      let regionCell: string | null = gi === 0 ? region : null;
      if (region === 'Turku') regionCell = ['Turku', 'Turku ', 'turku', 'Turku '][gi];
      const row: Array<string | number | null> = [regionCell, group];
      let rowTotal = 0;
      for (let m = 1; m <= 12; m++) {
        let v = GROUP_BASE[group] * REGION_SIZE[region] * seasonal(group, m) * (1 + 0.02 * (m - 1));
        v *= 1 + rng.normal(0, 0.05);
        if (region === 'Tampere' && group === 'Urheilu' && m === 6) v *= 3;
        v = Math.round(v * 100) / 100;
        const key = `${region}|${group}|${m}`;
        if (emptyCells.has(key)) {
          row.push(null);
          continue;
        }
        clean.push({ region, group, month: m, value: v });
        totals[m - 1] += v;
        rowTotal += v;
        if (rng.chance(0.1)) {
          textCells.add(key);
          row.push(fiNumber(v));
        } else {
          row.push(v);
        }
      }
      row.push(null, Math.round(rowTotal * 100) / 100);
      grand += rowTotal;
      sheet.push(row);
      rowIndex++;
    });
    if (region !== 'Turku') merges.push({ s: { r: groupStart, c: 0 }, e: { r: groupStart + 3, c: 0 } });
  }
  sheet.push(['Yhteensä', null, ...totals.map((t) => Math.round(t * 100) / 100), null, Math.round(grand * 100) / 100]);
  return { sheet, merges, clean };
}

const FIRST = ['Aino', 'Eero', 'Liisa', 'Mikko', 'Sanna', 'Juha', 'Maija', 'Ville', 'Anni', 'Pekka', 'Laura', 'Tuomas', 'Emilia', 'Olli', 'Kaisa'];
const LAST = ['Virtanen', 'Korhonen', 'Mäkinen', 'Nieminen', 'Mäkelä', 'Hämäläinen', 'Laine', 'Heikkinen', 'Koskinen', 'Järvinen', 'Lehtonen', 'Saarinen'];
const COMPANIES = ['Oy', 'Ab', 'Tmi', 'Ky'];

/** Sheet "Asiakkaat": 400 customers + 3 identical duplicate rows. */
export function customersSheet(rng = new Rng(2026)): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [
    ['Asiakasnumero', 'Nimi', 'Kaupunki', 'Asiakkaaksi', 'Segmentti', 'Aktiivinen', 'Vuosimyynti (€)'],
  ];
  for (let i = 1; i <= 400; i++) {
    const segment = rng.weighted(['Kuluttaja', 'Yritys', 'Julkinen'], [6, 3, 1]);
    const name =
      segment === 'Kuluttaja'
        ? `${rng.pick(FIRST)} ${rng.pick(LAST)}`
        : `${rng.pick(LAST)} ${rng.pick(COMPANIES)}`;
    const y = rng.int(2015, 2025);
    const m = rng.int(1, 12);
    const d = rng.int(1, daysInMonth(y, m));
    const joined: string | number = rng.chance(0.3) ? excelSerial(y, m, d) : fiDate(y, m, d);
    const sales = Math.round(rng.float() * (segment === 'Kuluttaja' ? 2400 : 38000) * 100) / 100 + 50;
    rows.push([
      String(i * 3 + 100).padStart(6, '0'),
      name,
      rng.weighted(REGIONS, [5, 3, 3, 2, 2, 2]),
      joined,
      segment,
      rng.chance(0.82) ? 'kyllä' : 'ei',
      sales,
    ]);
  }
  for (const i of [17, 142, 301]) rows.push([...rows[i]]);
  return rows;
}

const PRODUCTS: Array<{ name: string; category: string; price: number }> = [
  { name: 'Trail Runner', category: 'Shoes', price: 129 },
  { name: 'City Sneaker', category: 'Shoes', price: 89 },
  { name: 'Winter Boot', category: 'Shoes', price: 159 },
  { name: 'Rain Jacket', category: 'Jackets', price: 179 },
  { name: 'Down Parka', category: 'Jackets', price: 289 },
  { name: 'Fleece', category: 'Jackets', price: 79 },
  { name: 'Wool Beanie', category: 'Accessories', price: 29 },
  { name: 'Leather Belt', category: 'Accessories', price: 45 },
  { name: 'Backpack', category: 'Accessories', price: 99 },
  { name: 'Yoga Mat', category: 'Sports', price: 39 },
  { name: 'Running Shorts', category: 'Sports', price: 35 },
  { name: 'Training Top', category: 'Sports', price: 42 },
];
const US_REGIONS = ['North', 'South', 'East', 'West', 'Central'];

/** sales-orders.csv (21.2): December spike, growing web share, discount ↔ quantity r ≈ 0.5. */
export function salesOrders(rng = new Rng(2025)): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['order_id', 'order_date', 'customer_id', 'product', 'category', 'region', 'quantity', 'unit_price', 'discount_pct', 'channel'],
  ];
  const monthWeights = [0.8, 0.75, 0.85, 0.9, 0.95, 0.9, 0.85, 0.9, 1.0, 1.05, 1.3, 2.1];
  for (let i = 1; i <= 5000; i++) {
    const year = rng.chance(0.5) ? 2024 : 2025;
    const month = rng.weighted([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], monthWeights);
    const day = rng.int(1, daysInMonth(year, month));
    const t = (year - 2024) * 12 + month; // 1..24
    const webShare = 0.25 + (0.3 * t) / 24;
    const channel = rng.weighted(['web', 'store', 'partner'], [webShare, 0.6 - webShare / 2, 0.4 - webShare / 2]);
    const product = rng.pick(PRODUCTS);
    const discount = rng.weighted([0, 5, 10, 15, 20, 30], [5, 2, 2, 1.5, 1, 0.5]);
    const quantity = Math.max(1, Math.round(1 + discount * 0.12 + rng.normal(0, 1.1) + rng.float()));
    rows.push([
      `SO-${String(i).padStart(5, '0')}`,
      isoDate(year, month, day),
      `C${String(rng.int(1, 800)).padStart(4, '0')}`,
      product.name,
      product.category,
      rng.weighted(US_REGIONS, [3, 2, 2.5, 2.2, 1.3]),
      quantity,
      product.price,
      discount,
      channel,
    ]);
  }
  return rows;
}

/** tilaukset-q1/q2.csv (21.3): same structure, Q2 with reordered columns. */
export function quarterOrders(quarter: 1 | 2, rng = new Rng(2025 + quarter)): Array<Array<string>> {
  const header = ['Tilausnro', 'Päivämäärä', 'Asiakas', 'Tuote', 'Määrä', 'Hinta €', 'Myyjä'];
  const rows: string[][] = [];
  const products = ['Kengät', 'Takki', 'Pipo', 'Hanskat', 'Reppu', 'Sukat'];
  const sellers = ['Äijälä', 'Öhman', 'Kärkkäinen', 'Saarinen'];
  for (let i = 1; i <= 150; i++) {
    const m = (quarter - 1) * 3 + rng.int(1, 3);
    const d = rng.int(1, daysInMonth(2025, m));
    rows.push([
      String(quarter * 10000 + i),
      fiDate(2025, m, d),
      `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
      rng.pick(products),
      String(rng.int(1, 6)),
      fiNumber(rng.int(900, 25000) / 100),
      rng.pick(sellers),
    ]);
  }
  if (quarter === 1) return [header, ...rows];
  const order = [0, 3, 1, 2, 6, 5, 4];
  return [order.map((i) => header[i]), ...rows.map((r) => order.map((i) => r[i]))];
}

/** asiakkaat.csv + tilaukset.csv (21.4): 95 % of orders reference an existing customer. */
export function relationSample(rng = new Rng(2027)): { customers: string[][]; orders: string[][] } {
  const customers: string[][] = [['id', 'nimi', 'kaupunki', 'segmentti']];
  for (let i = 1; i <= 200; i++) {
    customers.push([String(i), `${rng.pick(FIRST)} ${rng.pick(LAST)}`, rng.pick(REGIONS), rng.pick(['Kuluttaja', 'Yritys'])]);
  }
  const orders: string[][] = [['tilaus_id', 'asiakas_id', 'pvm', 'summa']];
  for (let i = 1; i <= 1200; i++) {
    const orphan = rng.chance(0.05);
    const customer = orphan ? rng.int(201, 260) : rng.int(1, 200);
    const m = rng.int(1, 12);
    orders.push([
      String(5000 + i),
      String(customer),
      isoDate(2025, m, rng.int(1, daysInMonth(2025, m))),
      (rng.int(1500, 60000) / 100).toFixed(2),
    ]);
  }
  return { customers, orders };
}

/** tuotteet.json (21.5): nested categories and tag arrays. */
export function productsJson(rng = new Rng(2028)) {
  const categories = [
    { id: 1, nimi: 'Kengät' },
    { id: 2, nimi: 'Takit' },
    { id: 3, nimi: 'Asusteet' },
    { id: 4, nimi: 'Urheilu' },
  ];
  const names = ['Polku', 'Kaupunki', 'Talvi', 'Sade', 'Tunturi', 'Rata', 'Metsä', 'Ranta'];
  const kinds: Record<number, string[]> = { 1: ['kenkä', 'saapas'], 2: ['takki', 'parka'], 3: ['pipo', 'reppu', 'vyö'], 4: ['paita', 'shortsit', 'matto'] };
  return Array.from({ length: 60 }, (_, i) => {
    const kategoria = rng.pick(categories);
    const tags = ['uutuus', 'ale', 'suosikki', 'kotimainen'].filter(() => rng.chance(0.3));
    return {
      id: i + 1,
      nimi: `${rng.pick(names)}${rng.pick(kinds[kategoria.id])}`,
      kategoria,
      hinta: Math.round(rng.int(1900, 29900)) / 100,
      varastossa: rng.int(0, 250),
      tagit: tags,
    };
  });
}

export { pad };

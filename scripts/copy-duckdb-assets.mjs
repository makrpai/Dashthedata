// Copies the DuckDB-WASM bundles into public/duckdb so they are served from our own origin.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
const dest = join(root, 'public', 'duckdb');
const files = [
  'duckdb-mvp.wasm',
  'duckdb-eh.wasm',
  'duckdb-browser-mvp.worker.js',
  'duckdb-browser-eh.worker.js',
];

if (!existsSync(src)) {
  console.warn('[copy-duckdb-assets] @duckdb/duckdb-wasm not installed, skipping');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const file of files) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log(`[copy-duckdb-assets] copied ${files.length} files to public/duckdb`);

# Decision log

Lightweight ADRs. Every deviation from the implementation plan, library version choice and
ambiguous point in the plan is recorded here (plan section 25.1).

## 2026-09-26 – Library versions
**Context:** The plan asks for the latest stable versions at install time.
**Decision:** Next.js 16.3.6, React 19.2, Tailwind CSS 4, Zod 4, ECharts 6, Vitest 5, Playwright 1.63,
`@duckdb/duckdb-wasm` 1.32.0 (the npm `latest` tag points to a `-dev` build, so the newest version
without a pre-release suffix was pinned), `@duckdb/node-api` 1.5.5 for Node tests.
**Consequences:** Browser (DuckDB ≈1.4 inside WASM) and Node test engine (1.5) differ by a minor
DuckDB version. Only SQL supported by both is used.

## 2026-09-26 – SheetJS from npm instead of cdn.sheetjs.com
**Context:** The plan says to install the newest SheetJS tarball from cdn.sheetjs.com. That host was
not reachable from the build environment.
**Decision:** Use `xlsx@0.18.5` from npm. The API used (`XLSX.read`, `!merges`, `!ref`, dense mode)
is identical in newer versions. To upgrade, run
`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (no code changes needed).
**Consequences:** `npm audit` reports the known 0.18.5 advisories (prototype pollution / ReDoS when
parsing hostile files). Parsing happens only in the user's own browser inside a worker, on files the
user chose, so the blast radius is the user's own tab. Upgrading is recommended when possible.

## 2026-09-26 – `next lint` removed
**Context:** Next.js 16 removed `next lint`.
**Decision:** `npm run lint` runs `eslint .` with the flat config from `eslint-config-next`.
`npm run typecheck` runs `next typegen && tsc --noEmit` so the generated route types exist.

## 2026-09-26 – English token and identifier names
**Context:** The plan names design tokens in Finnish (`--pohja`, `--koralli`…) but also requires
English identifiers everywhere in code.
**Decision:** Tokens use English names; the mapping is documented at the top of
`src/styles/tokens.css` (`--pohja` → `--base`, `--pinta-litea` → `--surface`, `--koralli` →
`--accent`, `--koralli-teksti` → `--accent-fg`, `--teksti` → `--fg`, `--teksti-2` → `--fg-2`,
`--navy` → `--primary`, `--onnistui` → `--success`, `--virhe` → `--danger`, `--reuna` → `--line`).

## 2026-09-26 – UI locale on the server from a cookie
**Context:** The plan stores the UI language in `localStorage['dtd:locale']` and otherwise uses
`navigator.language`. Server rendering cannot read either, which would flash English text for Finnish
users.
**Decision:** The language switch writes both `localStorage['dtd:locale']` and a `dtd-locale`
cookie. The root layout reads the cookie, falling back to `Accept-Language` (the server-side
equivalent of `navigator.language`).
**Consequences:** Pages are rendered per request (dynamic) instead of statically. Theme and contrast
are applied before first paint with an inline script (Next.js "preventing flash" guide), so they stay
in localStorage only.

## 2026-09-26 – shadcn/ui components written by hand
**Context:** The shadcn registry (ui.shadcn.com) was not reachable, so `shadcn init/add` could not
run.
**Decision:** The components listed in 17.7 are written in `src/components/ui` in shadcn style on top
of the `radix-ui` package, `cmdk`, `sonner` and `react-resizable-panels`, with the neumorphic
variants built in (Button `primary`/`soft`/`ghost`, inset Input, etc.).

## 2026-09-26 – Logo proportions
**Context:** `docs/brand/logo-reference.jpg` (Elegantti version) was provided.
**Decision:** The canonical SVG from the plan already matches the reference closely (three scattered
coral pieces, three rising navy bars with rounded corners, "the" at half size on the same baseline).
No geometry changes were needed. The wordmark uses Bricolage Grotesque 700 with `-0.02em` tracking.

## 2026-09-26 – OG image in English, font files in the repo
**Context:** `ImageResponse` needs font data at build time.
**Decision:** Bricolage Grotesque (OFL) 500/700 TTF files are committed to `src/assets/fonts` and
read by `src/app/opengraph-image.tsx`. The image text is English, as the plan allows.

## 2026-09-26 – CSP in development
**Context:** Next.js dev mode needs `eval` for React Refresh and a WebSocket for HMR.
**Decision:** `'unsafe-eval'` and `ws:` are added to the CSP only when `NODE_ENV !== 'production'`.
The production policy is exactly the one in section 18, with the local-model hosts from 15.6 added to
`connect-src` from the start (Ollama/LM Studio on localhost and the WebLLM model hosts).

## 2026-09-26 – String matrices are loaded as CSV, not Arrow
**Context:** The plan loads Excel/JSON matrices with `tableFromArrays` + `insertArrowTable`.
apache-arrow's vector builders compile code with `new Function`, which the production CSP
(`script-src` without `'unsafe-eval'`) blocks.
**Decision:** `createStringTable` serialises the matrix as CSV (every non-null value quoted, NULL as an
empty unquoted field), registers it as a virtual file and reads it with `read_csv` using explicit
VARCHAR columns and `allow_quoted_nulls = false`. The Node test runner uses the same SQL.
**Consequences:** The CSP stays strict. The top-level `apache-arrow` is pinned to 17 to match
duckdb-wasm, and is only used to read query results.

## 2026-09-26 – Excel dates from number formats, not `cellDates`
**Context:** SheetJS `cellDates: true` builds JS Dates in the local time zone, which can shift dates.
**Decision:** Cells are read with `cellNF: true`; numeric cells whose format is a date format
(`SSF.is_date`) are converted from the serial number with UTC arithmetic (1900 and 1904 systems).

## 2026-09-26 – Row order and blank lines in CSV
**Decision:** `__row` comes from DuckDB's `rowid` of the staging table (insertion order is preserved),
not from `row_number() OVER ()`. DuckDB skips completely blank lines while reading; they would be
removed by `dropEmptyRows` anyway.

## 2026-09-26 – Large CSV files
**Decision:** UTF-8 CSV/TSV files above 100 MB are registered with `registerFileHandle` (7.3) and are
not copied into IndexedDB (they would double the memory use); after a reload the user drops them
again. Measured: a 1 million row, 37 MB CSV imports in ≈4.5 s with the longest main-thread task
≈140 ms.

## 2026-09-26 – Preview without @tanstack/react-table
**Decision:** The preview grid is a small ARIA grid on top of `@tanstack/react-virtual`; a headless
table model added nothing for a read-only, windowed grid. `@tanstack/react-table` stays available
for sortable top-N tables in phase 4.

## 2026-09-26 – One definition for parsing in JS and SQL
**Context:** Type inference runs in JS on a sample, but conversion must be SQL (castTypes).
**Decision:** Number and date formats are defined once as RE2/JS-compatible regular expressions.
JS uses them to decide the type; SQL reuses them: numbers are cleaned and `TRY_CAST … AS DOUBLE`,
dates are rebuilt as `Y-M-D H:M:S` with `regexp_extract` and `TRY_CAST … AS TIMESTAMP` (instead of
`strptime`, which cannot express month names, quarters or two-digit year pivots). Tests run every
case through both paths against a real DuckDB.
`castTypes` stores `dateFormats: string[]` (several formats are coalesced) instead of a single
`dateFormat` string.

## 2026-09-26 – Ambiguous month abbreviations
**Context:** "mar" is November in Finnish (marraskuu) and March in English.
**Decision:** A column's month vocabulary is guessed from Finnish-only / English-only tokens; ties use
the data locale. The format id records the choice (`monthName:fi` / `monthName:en`).
Time zone offsets in ISO timestamps are dropped (wall-clock time is kept).

## 2026-09-26 – Pipeline details
- **promoteHeader** stores the header names in its params (`{ row, names }`) because `toSql` is pure;
  the runner re-reads the header row on every run, so refreshed data picks up new names.
  `row: null` means "no header" and generates Sarake/Column 1…N.
- **unpivot** uses parallel `unnest([...])` lists instead of `UNPIVOT`, which keeps NULL cells
  (the sample report's two empty cells stay as rows) and the original row order. Period values are
  computed at detection time and stored in the params; the value column is named from the sheet name
  without the year ("Myynti 2025" → "Myynti"), otherwise Arvo/Value.
- **clean_<id> keeps `__row`**: previews page with `ORDER BY __row` and before/after diffs join on it.
  Charts and exports select explicit columns, so the helper column never shows.
- **Large inputs** (> 200 000 rows) materialise every stage as a table instead of a view, so
  measuring effects does not re-evaluate the whole chain for each step.
- **Parse failures** are measured in SQL on the full data (value present before castTypes, NULL
  after), not only on the inference sample.
- **Foreign keys**: integer/text columns named like `asiakas_id`, `…tunnus`, `…nro`, `…koodi` get the
  role `id` even when values repeat. The plan's rule would make `asiakas_id` a measure, which would
  hide it from relationship detection (10.2 only considers id/dimension columns).
- **Suggestions** are stored as steps with `suggested: true` and `enabled: false`; "Apply" turns them
  on, "Dismiss" removes them.

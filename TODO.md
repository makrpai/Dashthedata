# TODO – implementation phases

Checklist of the phases in the implementation plan (section 23). Tick items as they land.

## Phase 0 – Foundation
- [x] Next.js (App Router, TypeScript strict, Tailwind, ESLint, `src/`, `@/*`)
- [x] UI components (17.7) with neumorphic variants, design tokens (day, night, high contrast)
- [x] Fonts: Manrope, Bricolage Grotesque, JetBrains Mono via `next/font`
- [x] Component gallery `/dev/ui` with accent switcher
- [x] Brand: `brand.json`, `npm run brand`, `Logo`, favicon, app icon, OG image
- [x] Dependencies, Prettier, Vitest (node + jsdom projects), Playwright, CI workflow
- [x] i18n (fi + en), language, theme and contrast switching
- [x] AppShell: sidebar (all routes, collapse, `[` shortcut, mobile drawer, active state, arrow keys), top bar with breadcrumbs, empty views
- [x] Landing page skeleton
- [x] `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `TODO.md`, `.env.example`, `LICENSE`, README skeleton
- [x] Domain types and Zod schemas

## Phase 1 – DuckDB and file import
- [x] `copy-duckdb-assets.mjs`, DuckDB client, query queue, `quoteIdent`/`sqlLiteral` + tests
- [x] Ingest: Excel worker + SheetPicker, CSV (encoding + delimiter), JSON (flattening, columnar), Parquet
- [x] Zustand store (project, sources, datasets), DropZone (many files, whole-window drag)
- [x] Data view: source cards
- [x] DataPreview (virtualised)
- [x] `generate-samples.ts` and sample files
- [x] Integration tests for ingest

## Phase 2 – Profiling and type inference
- [x] `numberFormat`, `dateFormat`, `inferType`, `roles`, `stats` + test tables
- [x] Column headers: type icon, mini distribution, null share, warnings

## Phase 3 – ETL pipeline and automatic clean-up
- [x] `StepDefinition`, all step types, `pipeline.ts`
- [x] Auto-detections (9.4) in the order of 9.2
- [x] Clean-up view: log (animation), step cards, before/after, column menu, add step, formula editor, undo/redo
- [x] Fixtures match expectations

## Phase 4 – Charts
- [ ] `spec.ts`, `queryBuilder.ts`, `echartsOption.ts`, `format.ts` + tests
- [ ] EChart wrapper, ChartTile, ChartEditor, table view

## Phase 5 – Suggestions and automatic dashboard
- [ ] Suggestion engine, reasons, autoLayout, suggestion panel, "Why this?"
- [ ] Dashboard created automatically after first import

## Phase 6 – Dashboard interaction and persistence
- [ ] react-grid-layout, tile menu, FilterBar, cross-filtering, keyboard moves
- [ ] IndexedDB persistence, project list, project file export/import, remembered files
- [ ] Exports: PNG, PDF, CSV, Parquet

## Phase 7 – Multiple sources and model
- [ ] Union suggestion + dataset, relationship detection, model view, join dataset

## Phase 8 – Connectors
- [ ] `ssrf.ts`, `sqlGuard.ts`, PostgreSQL, MySQL, HTTP, demo DB and demo API endpoints
- [ ] Integrations view, connect dialogs, Google Sheets detection, refresh data
- [ ] `docker-compose.yml` for local databases

## Phase 9a – AI: provider interface and Claude
- [ ] `LlmProvider`, shared tasks, `anthropic.ts`, `ratelimit.ts`, endpoints
- [ ] AI view, ConsentDialog, PrivacyPanel, AskBox, InsightPanel, BYOK

## Phase 9b – AI: local models
- [ ] `localServer.ts`, `browserLlm.ts`, small-model tasks, CSP

## Phase 10 – Polish and release
- [ ] Landing page final, logo animation, privacy page
- [ ] Accessibility, performance numbers, error/empty states
- [ ] README.md + README.fi.md, ARCHITECTURE.md, screenshots, GIF

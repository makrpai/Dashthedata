<p align="center"><img src="public/brand/mark.svg" width="72" alt=""></p>

# Dash the Data

**From messy data to a dashboard in a minute.** Open-source, browser-based BI: drop in a messy
Excel, CSV, database or API and get cleaned data, an explanation of what was cleaned and a ready
dashboard with a reason for every chart. [Suomeksi](README.fi.md)

[![CI](https://github.com/makrpai/dashthedata/actions/workflows/ci.yml/badge.svg)](https://github.com/makrpai/dashthedata/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0F2747.svg)](LICENSE)

Phases 0–10 from the implementation plan are in the tree: import and clean-up, charts, a draggable
dashboard, unions and joins, database/HTTP connectors, and optional Claude or local models.
See [TODO.md](TODO.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Start local databases with `docker compose up` (see `docker-compose.yml`). Set `CONNECTORS_ALLOW_PRIVATE=true`
in `.env.local` before connecting to them.

## Local development

```bash
npm install          # also copies the DuckDB-WASM bundles to public/duckdb
cp .env.example .env.local
npm run dev
```

| Script | What it does |
|---|---|
| `npm run lint` / `typecheck` / `test` | ESLint, TypeScript, Vitest |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run brand` | Regenerates logo files and brand colours from `src/styles/brand.json` |
| `npm run samples` | Regenerates the sample files in `public/samples` |

## License

MIT

# Architecture

Dash the Data is a local-first BI tool. Heavy work (parsing, clean-up, queries) runs in the browser
with DuckDB-WASM in a web worker; the server only hosts thin, stateless functions (AI proxy, database
connectors, HTTP proxy).

```mermaid
flowchart LR
  subgraph Browser
    UI["React UI (Next.js)"]
    Store["Zustand + IndexedDB"]
    subgraph Worker["Web worker"]
      DuckDB["DuckDB-WASM"]
    end
    XL["SheetJS worker"]
    UI <--> Store
    UI -- SQL --> DuckDB
    UI -- file --> XL -- "string matrix → Arrow" --> DuckDB
  end
  subgraph Server["Serverless functions (Node)"]
    AI["/api/ai/*"]
    PG["/api/connectors/postgres"]
    MY["/api/connectors/mysql"]
    HTTP["/api/connectors/http"]
  end
  UI -- "schema + statistics" --> AI --> Claude["Claude API"]
  UI -- "local model" --> Local["WebLLM / Ollama / LM Studio"]
  UI -- "query + credentials" --> PG --> PGDB[(PostgreSQL)]
  UI -- "query + credentials" --> MY --> MYDB[(MySQL)]
  UI -- URL --> HTTP --> API["External REST API"]
```

## Data flow

```
Source → [ingest] → raw_<id> (all VARCHAR, __row keeps the original order)
       → [pipeline: one SQL view per step] → clean_<datasetId> (materialised, typed)
       → [profiling] → ColumnProfile[]
       → [suggestion engine] → ChartSpec[]
       → [queryBuilder] → SQL → DuckDB → rows → [echartsOption] → chart
```

The sections below are filled in as the phases land.

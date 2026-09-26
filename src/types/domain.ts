/** Domain model (plan section 6). Charts reference columns by stable `columnId`, never by name. */
export type Locale = 'fi' | 'en';
export type Localized = { fi: string; en: string };

// ---------- Sources ----------
export type SourceKind = 'file' | 'http' | 'postgres' | 'mysql' | 'demo-db';
export type FileFormat = 'xlsx' | 'xls' | 'csv' | 'tsv' | 'json' | 'parquet';

export interface DbQuery {
  mode: 'table';
  schema?: string;
  table: string;
  columns?: string[];
}
export interface DbSqlQuery {
  mode: 'sql';
  sql: string;
}

export interface Source {
  id: string;
  kind: SourceKind;
  /** Display name, e.g. "myynti.xlsx / Myynti 2025". */
  name: string;
  createdAt: string;
  lastLoadedAt?: string;
  /** DuckDB table, e.g. "raw_k3j9x". */
  rawTable: string;
  rowCount: number;
  /** Columns in the raw table (c0…cN). */
  columnCount?: number;
  /** True for databases and Parquet (types are known). */
  typedAtSource: boolean;
  file?: {
    name: string;
    size: number;
    format: FileFormat;
    sheet?: string;
    encoding?: string;
    lastModified?: number;
    delimiter?: string;
  };
  /** Header VALUES are never stored, only names. */
  http?: {
    url: string;
    format: 'json' | 'csv' | 'auto';
    recordsPath?: string;
    headerNames?: string[];
    pagination?: HttpPagination;
  };
  db?: {
    host: string;
    port: number;
    database: string;
    user: string;
    ssl: 'require' | 'prefer' | 'disable';
    query: DbQuery | DbSqlQuery;
    rowLimit: number;
  };
  /** Typed sources (Parquet, databases): original column names and types of c0…cN. */
  columnNames?: string[];
  columnTypes?: ColumnType[];
  /** IndexedDB key of the stored file bytes (rememberData). */
  blobKey?: string;
  /** Excel merged-cell hints for fill-down detection: column indexes (c0 = 0) with merges. */
  mergedColumns?: number[];
  /** Import warnings, e.g. error cells converted to NULL. */
  warnings?: Array<{ key: string; params?: Record<string, string | number> }>;
}

export interface HttpPagination {
  type: 'none' | 'page' | 'offset' | 'next-link';
  param?: string;
  pageSizeParam?: string;
  pageSize?: number;
  maxPages?: number;
}

// ---------- Datasets ----------
export type DatasetKind = 'source' | 'union' | 'join';

export interface Dataset {
  id: string;
  name: string;
  kind: DatasetKind;
  sourceIds: string[];
  /** Raw table (source) or view (union/join). */
  inputTable: string;
  pipeline: PipelineStep[];
  /** "clean_<id>" */
  outputTable: string;
  /** Increments every time the pipeline runs; invalidates caches. */
  version: number;
  columns: ColumnProfile[];
  rowCount: number;
  /** e.g. skipped title rows ("Myyntiraportti 2025"). */
  notes?: string[];
  /** Hidden from chart suggestions (e.g. parts of a union). */
  hidden?: boolean;
  /** User overrides of role per column id. */
  roleOverrides?: Record<string, ColumnRole>;
  /** For union datasets: member dataset ids. For join datasets: fact dataset id. */
  memberDatasetIds?: string[];
  /** True once automatic ETL has been run for this dataset. */
  autoDetected?: boolean;
}

export type ColumnType = 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'text';
export type ColumnRole = 'measure' | 'dimension' | 'time' | 'id' | 'text';

export interface ColumnFormat {
  unit?: 'currency' | 'percent';
  currency?: string;
  decimals?: number;
  timeGrainHint?: TimeGrain;
}

export interface ColumnProfile {
  /** Stable, e.g. "col_a81f". */
  id: string;
  /** Safe identifier in DuckDB, e.g. "myynti_eur". */
  sqlName: string;
  /** Original or user-given, e.g. "Myynti (€)". */
  displayName: string;
  type: ColumnType;
  role: ColumnRole;
  format?: ColumnFormat;
  stats: ColumnStats;
  warnings: DataWarning[];
  /** For join datasets: the dataset the column came from. */
  originDatasetId?: string;
  /** For join datasets: the column id in the origin dataset. */
  originColumnId?: string;
}

export interface ColumnStats {
  count: number;
  nulls: number;
  distinct: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  stddev?: number;
  sum?: number;
  skewness?: number;
  /** At most 10. */
  top?: Array<{ value: string; count: number }>;
  histogram?: Array<{ from: number; to: number; count: number }>;
}

export interface DataWarning {
  code:
    'parse_failures' | 'high_nulls' | 'mixed_types' | 'ambiguous_format' | 'possible_duplicates' | 'outliers';
  params: Record<string, string | number>;
}

// ---------- ETL ----------
export type StepKind =
  | 'skipRows'
  | 'promoteHeader'
  | 'dropEmptyRows'
  | 'dropEmptyColumns'
  | 'trimWhitespace'
  | 'removeTotalRows'
  | 'fillDown'
  | 'unpivot'
  | 'castTypes'
  | 'standardizeCategories'
  | 'dedupe'
  | 'renameColumn'
  | 'dropColumn'
  | 'filterRows'
  | 'calculatedColumn'
  | 'splitColumn'
  | 'replaceValues'
  | 'sortRows'
  | 'customSql';

export interface PipelineStep {
  id: string;
  kind: StepKind;
  /** Exact type per kind lives in the zod schemas (9.3). */
  params: Record<string, unknown>;
  origin: 'auto' | 'user' | 'ai';
  enabled: boolean;
  /** 0–1 for auto-detections. */
  confidence?: number;
  /** A suggestion is shown dimmed in the log until the user accepts it. */
  suggested?: boolean;
  /** Filled in after a run. */
  effect?: StepEffect;
  error?: { code: string; params?: Record<string, string | number> };
}

export interface StepEffect {
  rowsBefore: number;
  rowsAfter: number;
  colsBefore: number;
  colsAfter: number;
  cellsChanged?: number;
}

// ---------- Model ----------
export interface Relationship {
  id: string;
  /** "Many" side (fact). */
  from: { datasetId: string; columnId: string };
  /** "One" side (dimension). */
  to: { datasetId: string; columnId: string };
  cardinality: 'many-to-one' | 'one-to-one';
  status: 'suggested' | 'accepted' | 'rejected';
  score: number;
  evidence: { overlap: number; uniquenessTo: number; nameSimilarity: number };
}

// ---------- Charts ----------
export type ChartType =
  | 'kpi'
  | 'line'
  | 'area'
  | 'bar'
  | 'hbar'
  | 'stackedBar'
  | 'scatter'
  | 'histogram'
  | 'donut'
  | 'heatmap'
  | 'table';
export type Agg = 'sum' | 'avg' | 'count' | 'countDistinct' | 'min' | 'max' | 'median';
export type TimeGrain = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type FilterOp =
  'eq' | 'neq' | 'in' | 'notIn' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'contains' | 'isNull' | 'notNull';

export type FilterValue =
  string | number | boolean | Array<string | number> | [string | number, string | number];

export interface FilterClause {
  columnId: string;
  op: FilterOp;
  value?: FilterValue;
  /** Optional time grain: compare date_trunc(grain, col) (used by cross-filters on time axes). */
  timeGrain?: TimeGrain;
}

export interface ChartSpec {
  id: string;
  datasetId: string;
  type: ChartType;
  /** A user title overrides the automatic one. */
  title?: string;
  /** i18n key → the title follows the UI language. */
  autoTitle?: { key: string; params: Record<string, string> };
  x?: { columnId: string; timeGrain?: TimeGrain; bins?: number };
  y: Array<{ columnId: string | '*'; agg: Agg; label?: string }>;
  /** Values beyond topN are grouped into "Other". */
  series?: { columnId: string; topN?: number };
  filters?: FilterClause[];
  sort?: { by: 'x' | 'y'; dir: 'asc' | 'desc' };
  limit?: number;
  options?: {
    stacked?: boolean;
    showLabels?: boolean;
    compareToPrevious?: boolean;
    percentOfTotal?: boolean;
  };
  /** For table charts: extra columns to show. */
  columns?: string[];
  origin: 'rule' | 'ai' | 'user';
  /** "Why this?" */
  reason?: { key: string; params: Record<string, string | number> };
  /** Free-text reason from AI (shown as-is, not translated). */
  aiReason?: string;
  aiProvider?: 'claude' | 'local';
  score?: number;
}

// ---------- Dashboard ----------
export interface DashboardTile {
  id: string;
  chartId: string;
  layout: { x: number; y: number; w: number; h: number };
}

export interface GlobalFilter {
  id: string;
  columnRef: { datasetId: string; columnId: string };
  kind: 'dateRange' | 'multiSelect' | 'numberRange';
  value?: FilterClause['value'];
}

export interface CrossFilter {
  sourceTileId: string;
  clause: FilterClause & { datasetId: string };
  /** Human-readable label, e.g. "Alue: Tampere". */
  label?: string;
}

export interface Insight {
  text: string;
  tone: 'neutral' | 'positive' | 'negative';
}

export interface Dashboard {
  id: string;
  name: string;
  tiles: DashboardTile[];
  globalFilters: GlobalFilter[];
  /** One at a time (simple and understandable). */
  crossFilter?: CrossFilter;
  /** Key = tileId or 'dashboard'. */
  insights?: Record<string, { bullets: Insight[]; generatedAt: string; locale: Locale; provider?: string }>;
}

// ---------- Project ----------
export interface ProjectSettings {
  /** Interpretation of numbers and dates in data, separate from the UI language. */
  dataLocale: 'auto' | 'fi' | 'en';
  /** Store file bytes in IndexedDB. */
  rememberData: boolean;
  ai: {
    enabled: boolean;
    consentGiven: boolean;
    includeCategoryValues: boolean;
    includeSampleRows: boolean;
  };
}

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sources: Source[];
  datasets: Dataset[];
  relationships: Relationship[];
  charts: ChartSpec[];
  dashboards: Dashboard[];
  settings: ProjectSettings;
}

/** Per-browser AI preferences (localStorage['dtd:ai']); not part of the project. */
export interface AiPreferences {
  provider: 'claude' | 'browser' | 'local-server' | 'none';
  /** The key itself lives only in sessionStorage. */
  claude: { useOwnKey: boolean };
  browser: { modelId?: string };
  localServer: {
    baseUrl: string;
    kind: 'auto' | 'ollama' | 'openai';
    model?: string;
    tier: 'small' | 'large';
  };
}

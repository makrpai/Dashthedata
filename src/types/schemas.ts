import { z } from 'zod';
import type {
  AiPreferences,
  ChartSpec,
  ColumnProfile,
  Dashboard,
  Dataset,
  FilterClause,
  PipelineStep,
  Project,
  Relationship,
  Source,
} from './domain';

/** Zod schemas mirroring domain.ts. Used for project import and validating AI responses. */
export const localeSchema = z.enum(['fi', 'en']);
export const localizedSchema = z.object({ fi: z.string(), en: z.string() });

export const sourceKindSchema = z.enum(['file', 'http', 'postgres', 'mysql', 'demo-db']);
export const fileFormatSchema = z.enum(['xlsx', 'xls', 'csv', 'tsv', 'json', 'parquet']);
export const columnTypeSchema = z.enum(['integer', 'decimal', 'boolean', 'date', 'datetime', 'text']);
export const columnRoleSchema = z.enum(['measure', 'dimension', 'time', 'id', 'text']);
export const timeGrainSchema = z.enum(['day', 'week', 'month', 'quarter', 'year']);
export const aggSchema = z.enum(['sum', 'avg', 'count', 'countDistinct', 'min', 'max', 'median']);
export const chartTypeSchema = z.enum([
  'kpi',
  'line',
  'area',
  'bar',
  'hbar',
  'stackedBar',
  'scatter',
  'histogram',
  'donut',
  'heatmap',
  'table',
]);
export const stepKindSchema = z.enum([
  'skipRows',
  'promoteHeader',
  'dropEmptyRows',
  'dropEmptyColumns',
  'trimWhitespace',
  'removeTotalRows',
  'fillDown',
  'unpivot',
  'castTypes',
  'standardizeCategories',
  'dedupe',
  'renameColumn',
  'dropColumn',
  'filterRows',
  'calculatedColumn',
  'splitColumn',
  'replaceValues',
  'sortRows',
  'customSql',
]);

const paramsRecord = z.record(z.string(), z.union([z.string(), z.number()]));

export const httpPaginationSchema = z.object({
  type: z.enum(['none', 'page', 'offset', 'next-link']),
  param: z.string().optional(),
  pageSizeParam: z.string().optional(),
  pageSize: z.number().int().positive().optional(),
  maxPages: z.number().int().min(1).max(20).optional(),
});

export const sourceSchema: z.ZodType<Source> = z.object({
  id: z.string(),
  kind: sourceKindSchema,
  name: z.string(),
  createdAt: z.string(),
  lastLoadedAt: z.string().optional(),
  rawTable: z.string(),
  rowCount: z.number(),
  typedAtSource: z.boolean(),
  file: z
    .object({
      name: z.string(),
      size: z.number(),
      format: fileFormatSchema,
      sheet: z.string().optional(),
      encoding: z.string().optional(),
      lastModified: z.number().optional(),
      delimiter: z.string().optional(),
    })
    .optional(),
  http: z
    .object({
      url: z.string(),
      format: z.enum(['json', 'csv', 'auto']),
      recordsPath: z.string().optional(),
      headerNames: z.array(z.string()).optional(),
      pagination: httpPaginationSchema.optional(),
    })
    .optional(),
  db: z
    .object({
      host: z.string(),
      port: z.number(),
      database: z.string(),
      user: z.string(),
      ssl: z.enum(['require', 'prefer', 'disable']),
      query: z.union([
        z.object({
          mode: z.literal('table'),
          schema: z.string().optional(),
          table: z.string(),
          columns: z.array(z.string()).optional(),
        }),
        z.object({ mode: z.literal('sql'), sql: z.string() }),
      ]),
      rowLimit: z.number(),
    })
    .optional(),
  columnNames: z.array(z.string()).optional(),
  columnTypes: z.array(columnTypeSchema).optional(),
  blobKey: z.string().optional(),
  mergedColumns: z.array(z.number()).optional(),
  warnings: z.array(z.object({ key: z.string(), params: paramsRecord.optional() })).optional(),
});

export const columnStatsSchema = z.object({
  count: z.number(),
  nulls: z.number(),
  distinct: z.number(),
  min: z.union([z.number(), z.string()]).optional(),
  max: z.union([z.number(), z.string()]).optional(),
  mean: z.number().optional(),
  median: z.number().optional(),
  stddev: z.number().optional(),
  sum: z.number().optional(),
  skewness: z.number().optional(),
  top: z.array(z.object({ value: z.string(), count: z.number() })).optional(),
  histogram: z.array(z.object({ from: z.number(), to: z.number(), count: z.number() })).optional(),
});

export const dataWarningSchema = z.object({
  code: z.enum([
    'parse_failures',
    'high_nulls',
    'mixed_types',
    'ambiguous_format',
    'possible_duplicates',
    'outliers',
  ]),
  params: paramsRecord,
});

export const columnProfileSchema: z.ZodType<ColumnProfile> = z.object({
  id: z.string(),
  sqlName: z.string(),
  displayName: z.string(),
  type: columnTypeSchema,
  role: columnRoleSchema,
  format: z
    .object({
      unit: z.enum(['currency', 'percent']).optional(),
      currency: z.string().optional(),
      decimals: z.number().optional(),
      timeGrainHint: timeGrainSchema.optional(),
    })
    .optional(),
  stats: columnStatsSchema,
  warnings: z.array(dataWarningSchema),
  originDatasetId: z.string().optional(),
  originColumnId: z.string().optional(),
});

export const stepEffectSchema = z.object({
  rowsBefore: z.number(),
  rowsAfter: z.number(),
  colsBefore: z.number(),
  colsAfter: z.number(),
  cellsChanged: z.number().optional(),
});

export const pipelineStepSchema: z.ZodType<PipelineStep> = z.object({
  id: z.string(),
  kind: stepKindSchema,
  params: z.record(z.string(), z.unknown()),
  origin: z.enum(['auto', 'user', 'ai']),
  enabled: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  suggested: z.boolean().optional(),
  effect: stepEffectSchema.optional(),
  error: z.object({ code: z.string(), params: paramsRecord.optional() }).optional(),
});

export const datasetSchema: z.ZodType<Dataset> = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['source', 'union', 'join']),
  sourceIds: z.array(z.string()),
  inputTable: z.string(),
  pipeline: z.array(pipelineStepSchema),
  outputTable: z.string(),
  version: z.number(),
  columns: z.array(columnProfileSchema),
  rowCount: z.number(),
  notes: z.array(z.string()).optional(),
  hidden: z.boolean().optional(),
  roleOverrides: z.record(z.string(), columnRoleSchema).optional(),
  memberDatasetIds: z.array(z.string()).optional(),
  autoDetected: z.boolean().optional(),
});

export const relationshipSchema: z.ZodType<Relationship> = z.object({
  id: z.string(),
  from: z.object({ datasetId: z.string(), columnId: z.string() }),
  to: z.object({ datasetId: z.string(), columnId: z.string() }),
  cardinality: z.enum(['many-to-one', 'one-to-one']),
  status: z.enum(['suggested', 'accepted', 'rejected']),
  score: z.number(),
  evidence: z.object({ overlap: z.number(), uniquenessTo: z.number(), nameSimilarity: z.number() }),
});

const scalar = z.union([z.string(), z.number()]);
export const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(scalar),
  z.tuple([scalar, scalar]),
]);

export const filterClauseSchema: z.ZodType<FilterClause> = z.object({
  columnId: z.string(),
  op: z.enum([
    'eq',
    'neq',
    'in',
    'notIn',
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'contains',
    'isNull',
    'notNull',
  ]),
  value: filterValueSchema.optional(),
  timeGrain: timeGrainSchema.optional(),
});

export const chartSpecSchema: z.ZodType<ChartSpec> = z.object({
  id: z.string(),
  datasetId: z.string(),
  type: chartTypeSchema,
  title: z.string().optional(),
  autoTitle: z.object({ key: z.string(), params: z.record(z.string(), z.string()) }).optional(),
  x: z
    .object({
      columnId: z.string(),
      timeGrain: timeGrainSchema.optional(),
      bins: z.number().int().min(2).max(200).optional(),
    })
    .optional(),
  y: z.array(z.object({ columnId: z.string(), agg: aggSchema, label: z.string().optional() })),
  series: z.object({ columnId: z.string(), topN: z.number().int().min(1).max(50).optional() }).optional(),
  filters: z.array(filterClauseSchema).optional(),
  sort: z.object({ by: z.enum(['x', 'y']), dir: z.enum(['asc', 'desc']) }).optional(),
  limit: z.number().int().positive().optional(),
  options: z
    .object({
      stacked: z.boolean().optional(),
      showLabels: z.boolean().optional(),
      compareToPrevious: z.boolean().optional(),
      percentOfTotal: z.boolean().optional(),
    })
    .optional(),
  columns: z.array(z.string()).optional(),
  origin: z.enum(['rule', 'ai', 'user']),
  reason: z.object({ key: z.string(), params: paramsRecord }).optional(),
  aiReason: z.string().optional(),
  aiProvider: z.enum(['claude', 'local']).optional(),
  score: z.number().optional(),
});

export const dashboardSchema: z.ZodType<Dashboard> = z.object({
  id: z.string(),
  name: z.string(),
  tiles: z.array(
    z.object({
      id: z.string(),
      chartId: z.string(),
      layout: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    }),
  ),
  globalFilters: z.array(
    z.object({
      id: z.string(),
      columnRef: z.object({ datasetId: z.string(), columnId: z.string() }),
      kind: z.enum(['dateRange', 'multiSelect', 'numberRange']),
      value: filterValueSchema.optional(),
    }),
  ),
  crossFilter: z
    .object({
      sourceTileId: z.string(),
      clause: z.intersection(filterClauseSchema, z.object({ datasetId: z.string() })),
      label: z.string().optional(),
    })
    .optional(),
  insights: z
    .record(
      z.string(),
      z.object({
        bullets: z.array(z.object({ text: z.string(), tone: z.enum(['neutral', 'positive', 'negative']) })),
        generatedAt: z.string(),
        locale: localeSchema,
        provider: z.string().optional(),
      }),
    )
    .optional(),
});

export const projectSettingsSchema = z.object({
  dataLocale: z.enum(['auto', 'fi', 'en']),
  rememberData: z.boolean(),
  ai: z.object({
    enabled: z.boolean(),
    consentGiven: z.boolean(),
    includeCategoryValues: z.boolean(),
    includeSampleRows: z.boolean(),
  }),
});

export const projectSchema: z.ZodType<Project> = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sources: z.array(sourceSchema),
  datasets: z.array(datasetSchema),
  relationships: z.array(relationshipSchema),
  charts: z.array(chartSpecSchema),
  dashboards: z.array(dashboardSchema),
  settings: projectSettingsSchema,
});

export const aiPreferencesSchema: z.ZodType<AiPreferences> = z.object({
  provider: z.enum(['claude', 'browser', 'local-server', 'none']),
  claude: z.object({ useOwnKey: z.boolean() }),
  browser: z.object({ modelId: z.string().optional() }),
  localServer: z.object({
    baseUrl: z.string(),
    kind: z.enum(['auto', 'ollama', 'openai']),
    model: z.string().optional(),
    tier: z.enum(['small', 'large']),
  }),
});

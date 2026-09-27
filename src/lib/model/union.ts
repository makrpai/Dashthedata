import { slugify } from '@/lib/etl/slugify';
import { quoteIdent } from '@/lib/duckdb/sql';
import type { ColumnProfile, ColumnType, Dataset } from '@/types/domain';

export interface UnionColumn {
  sqlName: string;
  displayName: string;
  type: ColumnType;
  /** dataset id → member column sql name. Missing means NULL. */
  members: Record<string, string>;
}

export interface UnionSuggestion {
  datasetIds: [string, string];
  shared: string[];
  score: number;
}

const TYPE_RANK: Record<ColumnType, number> = {
  text: 0,
  boolean: 1,
  integer: 2,
  decimal: 3,
  date: 4,
  datetime: 5,
};

/** Wider of two column types so a union does not drop precision. */
export function widenType(a: ColumnType, b: ColumnType): ColumnType {
  if (a === b) return a;
  if ((a === 'integer' && b === 'decimal') || (b === 'integer' && a === 'decimal')) return 'decimal';
  if ((a === 'date' && b === 'datetime') || (b === 'date' && a === 'datetime')) return 'datetime';
  if (TYPE_RANK[a] !== TYPE_RANK[b] && (a === 'text' || b === 'text')) return 'text';
  return TYPE_RANK[a] >= TYPE_RANK[b] ? a : b;
}

function bySlug(dataset: Dataset): Map<string, ColumnProfile> {
  const map = new Map<string, ColumnProfile>();
  for (const column of dataset.columns) {
    const key = slugify(column.displayName);
    if (key && !map.has(key)) map.set(key, column);
  }
  return map;
}

/** Columns shared by every member, aligned by normalised display name. */
export function alignUnion(datasets: Dataset[]): UnionColumn[] {
  if (datasets.length < 2) return [];
  const maps = datasets.map(bySlug);
  const shared = [...maps[0].keys()].filter((key) => maps.every((m) => m.has(key)));
  return shared.map((key) => {
    const cols = maps.map((m) => m.get(key)!);
    const type = cols.reduce((t, c) => widenType(t, c.type), cols[0].type);
    const members: Record<string, string> = {};
    datasets.forEach((d, i) => {
      members[d.id] = cols[i].sqlName;
    });
    return { sqlName: slugify(cols[0].displayName) || key, displayName: cols[0].displayName, type, members };
  });
}

/** Pairwise union suggestions (section 10). Score is the Jaccard overlap of column names. */
export function suggestUnions(datasets: Dataset[]): UnionSuggestion[] {
  const usable = datasets.filter((d) => d.kind === 'source' && d.columns.length > 0 && !d.hidden);
  const out: UnionSuggestion[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = bySlug(usable[i]);
      const b = bySlug(usable[j]);
      const shared = [...a.keys()].filter((k) => b.has(k));
      const union = new Set([...a.keys(), ...b.keys()]).size;
      const score = union === 0 ? 0 : shared.length / union;
      if (shared.length >= 2 && score >= 0.5) {
        out.push({ datasetIds: [usable[i].id, usable[j].id], shared, score });
      }
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

function castSql(expr: string, type: ColumnType): string {
  if (type === 'integer') return `TRY_CAST(${expr} AS BIGINT)`;
  if (type === 'decimal') return `TRY_CAST(${expr} AS DOUBLE)`;
  if (type === 'boolean') return `TRY_CAST(${expr} AS BOOLEAN)`;
  if (type === 'date') return `TRY_CAST(${expr} AS DATE)`;
  if (type === 'datetime') return `TRY_CAST(${expr} AS TIMESTAMP)`;
  return `CAST(${expr} AS VARCHAR)`;
}

/** SELECT that stacks member clean-tables with a shared column set. */
export function unionSelectSql(datasets: Dataset[], columns: UnionColumn[]): string {
  const branches = datasets.map((dataset) => {
    const fields = columns.map((column) => {
      const member = column.members[dataset.id];
      const expr = member ? castSql(quoteIdent(member), column.type) : 'NULL';
      return `${expr} AS ${quoteIdent(column.sqlName)}`;
    });
    fields.push(`'${dataset.name.replace(/'/g, "''")}' AS ${quoteIdent('__source')}`);
    return `SELECT ${fields.join(', ')} FROM ${quoteIdent(dataset.outputTable)}`;
  });
  return `SELECT row_number() OVER () AS ${quoteIdent('__row')}, * FROM (${branches.join(' UNION ALL ')})`;
}

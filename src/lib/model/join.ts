import { quoteIdent } from '@/lib/duckdb/sql';
import { freshSqlName } from '@/lib/etl/slugify';
import type { ColumnProfile, Dataset, Relationship } from '@/types/domain';

export interface JoinColumnPlan {
  sqlName: string;
  displayName: string;
  type: ColumnProfile['type'];
  originDatasetId: string;
  originColumnId: string;
  /** Quoted expression in the join SELECT. */
  expr: string;
}

/** Fact table plus accepted many-to-one relationships, left-joined. */
export function planJoin(fact: Dataset, datasets: Dataset[], relationships: Relationship[]): JoinColumnPlan[] {
  const accepted = relationships.filter((r) => r.status === 'accepted' && r.from.datasetId === fact.id);
  const used: Array<{ sqlName: string }> = [];
  const plan: JoinColumnPlan[] = [];
  const add = (column: ColumnProfile, dataset: Dataset, expr: string, displayName = column.displayName) => {
    const sqlName = freshSqlName(column.sqlName, used);
    used.push({ sqlName });
    plan.push({
      sqlName,
      displayName,
      type: column.type,
      originDatasetId: dataset.id,
      originColumnId: column.id,
      expr: `${expr} AS ${quoteIdent(sqlName)}`,
    });
  };
  for (const column of fact.columns) add(column, fact, `f.${quoteIdent(column.sqlName)}`);
  accepted.forEach((rel, index) => {
    const dim = datasets.find((d) => d.id === rel.to.datasetId);
    const fromCol = fact.columns.find((c) => c.id === rel.from.columnId);
    const toCol = dim?.columns.find((c) => c.id === rel.to.columnId);
    if (!dim || !fromCol || !toCol) return;
    const alias = `d${index}`;
    for (const column of dim.columns) {
      if (column.id === toCol.id) continue;
      add(column, dim, `${alias}.${quoteIdent(column.sqlName)}`, `${dim.name} · ${column.displayName}`);
    }
    void fromCol;
  });
  return plan;
}

export function joinSelectSql(fact: Dataset, datasets: Dataset[], relationships: Relationship[], plan: JoinColumnPlan[]): string {
  const accepted = relationships.filter((r) => r.status === 'accepted' && r.from.datasetId === fact.id);
  const joins = accepted
    .map((rel, index) => {
      const dim = datasets.find((d) => d.id === rel.to.datasetId);
      const fromCol = fact.columns.find((c) => c.id === rel.from.columnId);
      const toCol = dim?.columns.find((c) => c.id === rel.to.columnId);
      if (!dim || !fromCol || !toCol) return '';
      const alias = `d${index}`;
      return `LEFT JOIN ${quoteIdent(dim.outputTable)} ${alias} ON f.${quoteIdent(fromCol.sqlName)} = ${alias}.${quoteIdent(toCol.sqlName)}`;
    })
    .filter(Boolean);
  const fields = plan.map((c) => c.expr).join(', ');
  return `SELECT row_number() OVER () AS ${quoteIdent('__row')}, ${fields} FROM ${quoteIdent(fact.outputTable)} f ${joins.join(' ')}`;
}

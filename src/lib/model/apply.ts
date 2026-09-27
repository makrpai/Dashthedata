import { quoteIdent } from '@/lib/duckdb/sql';
import type { QueryRunner } from '@/lib/duckdb/types';
import { newId } from '@/lib/util/id';
import type { ColumnProfile, Dataset, Project } from '@/types/domain';
import { joinSelectSql, planJoin } from './join';
import { alignUnion, unionSelectSql } from './union';

function placeholderStats(): ColumnProfile['stats'] {
  return { count: 0, nulls: 0, distinct: 0 };
}

/** Creates or replaces the input view for a union or join dataset. */
export async function ensureModelView(runner: QueryRunner, dataset: Dataset, project: Project): Promise<boolean> {
  if (dataset.kind === 'source') return false;
  const members = (dataset.memberDatasetIds ?? []).map((id) => project.datasets.find((d) => d.id === id)).filter((d): d is Dataset => Boolean(d));
  if (members.length < 2 && dataset.kind === 'union') return false;
  let sql = '';
  if (dataset.kind === 'union') {
    const columns = alignUnion(members);
    if (!columns.length) return false;
    sql = unionSelectSql(members, columns);
  } else {
    const fact = members[0];
    if (!fact) return false;
    const plan = planJoin(fact, project.datasets, project.relationships);
    if (!plan.length) return false;
    sql = joinSelectSql(fact, project.datasets, project.relationships, plan);
  }
  await runner.exec(`DROP VIEW IF EXISTS ${quoteIdent(dataset.inputTable)}`);
  await runner.exec(`CREATE VIEW ${quoteIdent(dataset.inputTable)} AS ${sql}`);
  return true;
}

export function unionDataset(members: Dataset[], name: string): Dataset {
  const columns = alignUnion(members);
  const id = newId('d');
  return {
    id,
    name,
    kind: 'union',
    sourceIds: members.flatMap((d) => d.sourceIds),
    memberDatasetIds: members.map((d) => d.id),
    inputTable: `in_${id}`,
    pipeline: [],
    outputTable: `clean_${id}`,
    version: 0,
    rowCount: 0,
    autoDetected: true,
    columns: columns.map((c) => ({
      id: newId('col'),
      sqlName: c.sqlName,
      displayName: c.displayName,
      type: c.type,
      role: 'dimension',
      stats: placeholderStats(),
      warnings: [],
      originDatasetId: members[0]?.id,
    })),
  };
}

export function joinDataset(fact: Dataset, name: string, project: Project): Dataset | null {
  const plan = planJoin(fact, project.datasets, project.relationships);
  if (plan.length <= fact.columns.length) return null;
  const id = newId('d');
  const dimIds = [...new Set(project.relationships.filter((r) => r.status === 'accepted' && r.from.datasetId === fact.id).map((r) => r.to.datasetId))];
  return {
    id,
    name,
    kind: 'join',
    sourceIds: [fact, ...dimIds.map((dimId) => project.datasets.find((d) => d.id === dimId)).filter((d): d is Dataset => Boolean(d))].flatMap((d) => d.sourceIds),
    memberDatasetIds: [fact.id, ...dimIds],
    inputTable: `in_${id}`,
    pipeline: [],
    outputTable: `clean_${id}`,
    version: 0,
    rowCount: 0,
    autoDetected: true,
    columns: plan.map((c) => ({
      id: newId('col'),
      sqlName: c.sqlName,
      displayName: c.displayName,
      type: c.type,
      role: 'dimension',
      stats: placeholderStats(),
      warnings: [],
      originDatasetId: c.originDatasetId,
      originColumnId: c.originColumnId,
    })),
  };
}

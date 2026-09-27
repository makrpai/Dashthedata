import { projectSchema } from '@/types/schemas';
import type { Project } from '@/types/domain';

export const PROJECT_FILE_EXT = '.dtd.json';

/**
 * Project file (13): the Project without data bytes or credentials. Database passwords and HTTP
 * header values are never part of the project; IndexedDB blob keys are dropped too.
 */
export function toProjectFile(project: Project): string {
  const clean: Project = {
    ...project,
    sources: project.sources.map(({ blobKey: _b, ...s }) => ({
      ...s,
      http: s.http ? { ...s.http } : undefined,
    })),
    datasets: project.datasets.map((d) => ({ ...d, pipeline: d.pipeline.map(({ effect: _e, error: _er, ...st }) => st) })),
  };
  return JSON.stringify({ format: 'dashthedata', ...clean }, null, 2);
}

export class ProjectFileError extends Error {}

/** Parses and validates a project file with Zod. */
export function parseProjectFile(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProjectFileError('invalidJson');
  }
  if (typeof data === 'object' && data !== null && 'format' in data) {
    const { format: _f, ...rest } = data as Record<string, unknown>;
    data = rest;
  }
  const parsed = projectSchema.safeParse(data);
  if (!parsed.success) throw new ProjectFileError('invalidProject');
  return parsed.data;
}

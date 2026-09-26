import type { Project, ProjectSettings } from '@/types/domain';
import { newId } from '@/lib/util/id';

export const defaultProjectSettings = (): ProjectSettings => ({
  dataLocale: 'auto',
  rememberData: true,
  ai: { enabled: true, consentGiven: false, includeCategoryValues: false, includeSampleRows: false },
});

export function createEmptyProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: newId('p'),
    name,
    createdAt: now,
    updatedAt: now,
    sources: [],
    datasets: [],
    relationships: [],
    charts: [],
    dashboards: [],
    settings: defaultProjectSettings(),
  };
}

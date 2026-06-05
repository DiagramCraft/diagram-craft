import type { ViewId } from './viewId';

export const deriveActiveView = (matches: Array<{ routeId: string }>): ViewId => {
  const ids = matches.map(m => m.routeId);
  if (ids.some(id => id.includes('/diagrams/'))) return 'diagram';
  if (ids.some(id => id.includes('/entities/$entityId'))) return 'entity-detail';
  if (ids.some(id => id.includes('/entities/import'))) return 'entity-browser';
  if (ids.some(id => id.endsWith('/entities'))) return 'entity-browser';
  if (ids.some(id => id.includes('/projects/'))) return 'project-detail';
  if (ids.some(id => id.endsWith('/model'))) return 'data-model';
  if (ids.some(id => id.endsWith('/search'))) return 'search';
  if (ids.some(id => id.endsWith('/assistant'))) return 'assistant';
  if (ids.some(id => id.endsWith('/extract'))) return 'extract';
  if (ids.some(id => id.includes('/settings/global'))) return 'global-settings';
  if (ids.some(id => id.endsWith('/settings'))) return 'workspace-settings';
  if (ids.some(id => id.endsWith('/account'))) return 'account-settings';
  return 'home';
};

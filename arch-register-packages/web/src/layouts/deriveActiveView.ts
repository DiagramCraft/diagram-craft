import type { ViewId } from './viewId';

export const deriveActiveView = (matches: Array<{ routeId: string }>): ViewId => {
  const ids = matches.map(m => m.routeId);
  if (ids.some(id => id.includes('/diagrams/'))) return 'diagram';
  if (ids.some(id => id.includes('/entities/$entityId'))) return 'entity-detail';
  if (ids.some(id => id.endsWith('/entities'))) return 'entity-browser';
  if (ids.some(id => id.includes('/projects/'))) return 'project-detail';
  if (ids.some(id => id.endsWith('/model'))) return 'data-model';
  if (ids.some(id => id.endsWith('/search'))) return 'search';
  if (ids.some(id => id.endsWith('/settings'))) return 'workspace-settings';
  return 'home';
};

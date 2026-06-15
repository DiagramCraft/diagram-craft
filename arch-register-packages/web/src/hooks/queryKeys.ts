import { type QueryClient } from '@tanstack/react-query';

export const schemaKeys = {
  all: ['schemas'] as const,
  lists: () => [...schemaKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...schemaKeys.lists(), workspaceId] as const,
  details: () => [...schemaKeys.all, 'detail'] as const,
  detail: (workspaceId: string, schemaId: string) =>
    [...schemaKeys.details(), workspaceId, schemaId] as const,
};

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.lists(), workspaceId, filters] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (workspaceId: string, entityId: string) =>
    [...entityKeys.details(), workspaceId, entityId] as const,
  facets: (workspaceId: string) => [...entityKeys.all, 'facets', workspaceId] as const,
  relations: (workspaceId: string, entityId: string) =>
    [...entityKeys.all, 'relations', workspaceId, entityId] as const,
  tree: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.all, 'tree', workspaceId, filters] as const,
};

export const viewKeys = {
  all: ['views'] as const,
  lists: () => [...viewKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...viewKeys.lists(), workspaceId] as const,
};

export const snapshotKeys = {
  all: ['snapshots'] as const,
  list: (workspaceId: string, entityId: string) =>
    [...snapshotKeys.all, workspaceId, entityId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...snapshotKeys.all, 'by-project', workspaceId, projectId] as const,
};

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...projectKeys.lists(), workspaceId] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectKeys.details(), workspaceId, projectId] as const,
};

export const projectEntityKeys = {
  all: (workspaceId: string, projectId: string) =>
    ['project-entities', workspaceId, projectId] as const,
  entityProjects: (workspaceId: string, entityId: string) =>
    ['entity-projects', workspaceId, entityId] as const,
  entityDiagramFiles: (workspaceId: string, entityId: string) =>
    ['entity-diagram-files', workspaceId, entityId] as const,
};

export const entityContentKeys = {
  all: (workspaceId: string, entityId: string) =>
    ['entity-content', workspaceId, entityId] as const,
};

export const projectFileKeys = {
  all: ['project-files'] as const,
  lists: () => [...projectFileKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string) =>
    [...projectFileKeys.lists(), workspaceId, projectId] as const,
};

// Domain invalidation helpers

/** Invalidates all queries that may be affected by any entity state change. */
export const invalidateEntityQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: ['entities', 'tree'] as const }),
    queryClient.invalidateQueries({ queryKey: entityKeys.facets(workspaceId) }),
  ]);
};

/** Invalidates all queries that may be affected by any project or project-content change. */
export const invalidateProjectQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  projectId?: string
) => {
  const tasks: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) }),
  ];
  if (projectId) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspaceId, projectId) }),
      queryClient.invalidateQueries({ queryKey: projectFileKeys.list(workspaceId, projectId) }),
      queryClient.invalidateQueries({ queryKey: projectEntityKeys.all(workspaceId, projectId) }),
    );
  }
  await Promise.all(tasks);
};

/** Invalidates snapshot queries for an entity, and optionally for a project timeline. */
export const invalidateSnapshotQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string,
  projectId?: string | null
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: snapshotKeys.list(workspaceId, entityId) }),
    ...(projectId
      ? [queryClient.invalidateQueries({ queryKey: snapshotKeys.byProject(workspaceId, projectId) })]
      : []),
  ]);
};

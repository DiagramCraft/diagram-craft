import type { QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...entityKeys.lists(), workspaceId] as const,
  list: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.workspaceLists(workspaceId), filters] as const,
  counts: (workspaceId: string) => [...entityKeys.all, 'count', workspaceId] as const,
  count: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.counts(workspaceId), filters] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId: string) => [...entityKeys.details(), workspaceId] as const,
  detail: (workspaceId: string, entityId: string) =>
    [...entityKeys.workspaceDetails(workspaceId), entityId] as const,
  facets: (workspaceId: string) => [...entityKeys.all, 'facets', workspaceId] as const,
  timelineMarkers: (workspaceId: string) =>
    [...entityKeys.all, 'timelineMarkers', workspaceId] as const,
  workspaceRelations: (workspaceId: string) =>
    [...entityKeys.all, 'relations', workspaceId] as const,
  relations: (workspaceId: string, entityId: string) =>
    [...entityKeys.workspaceRelations(workspaceId), entityId] as const,
  workspaceBatchRelations: (workspaceId: string) =>
    [...entityKeys.all, 'batch-relations', workspaceId] as const,
  batchRelations: (workspaceId: string, ids: string[]) =>
    [...entityKeys.workspaceBatchRelations(workspaceId), ids] as const,
  workspaceDependents: (workspaceId: string) =>
    [...entityKeys.all, 'dependents', workspaceId] as const,
  dependents: (workspaceId: string, entityId: string, transitive: boolean) =>
    [...entityKeys.workspaceDependents(workspaceId), entityId, transitive] as const,
  trees: (workspaceId: string) => [...entityKeys.all, 'tree', workspaceId] as const,
  tree: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.trees(workspaceId), filters] as const
};

export const invalidateEntityDetails = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.relations(workspaceId, entityId) })
  ]);
};

export const invalidateEntityQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceLists(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.counts(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.trees(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.facets(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.timelineMarkers(workspaceId) }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};

export const invalidateDeletedEntity = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => {
  await Promise.all([
    invalidateEntityQueries(queryClient, workspaceId),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceDetails(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceRelations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceBatchRelations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceDependents(workspaceId) }),
    queryClient.removeQueries({ queryKey: entityKeys.detail(workspaceId, entityId) }),
    queryClient.removeQueries({ queryKey: entityKeys.relations(workspaceId, entityId) })
  ]);
};

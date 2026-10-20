import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';
import { relationKeys } from './relations';
import { orpcClient } from '../lib/orpcClient';

export const relationVersionKeys = {
  all: ['relationVersions'] as const,
  list: (workspaceId: string, relationId: string) =>
    [...relationVersionKeys.all, workspaceId, relationId] as const
};

export const relationVersionsQuery = (workspaceId: string, relationId: string, enabled = false) =>
  queryOptions({
    queryKey: relationVersionKeys.list(workspaceId, relationId),
    queryFn: () =>
      orpcClient.relationVersions.list({ params: { workspace: workspaceId, id: relationId } }),
    enabled: !!workspaceId && !!relationId && enabled
  });

export const invalidateRelationVersionQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  relationId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: relationVersionKeys.list(workspaceId, relationId) }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};

export const invalidateRestoredRelation = async (
  queryClient: QueryClient,
  workspaceId: string,
  relationId: string
) => {
  await Promise.all([
    invalidateRelationVersionQueries(queryClient, workspaceId, relationId),
    queryClient.invalidateQueries({ queryKey: relationKeys.workspaceLists(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: relationKeys.detail(workspaceId, relationId) })
  ]);
};

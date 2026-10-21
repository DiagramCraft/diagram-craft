import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { relationKeys } from './relations';

export const relationChangeKeys = {
  current: (workspaceId: string, relationId: string) =>
    ['relation-change', workspaceId, relationId] as const
};

export const relationChangeQuery = (workspaceId: string, relationId: string) =>
  queryOptions({
    queryKey: relationChangeKeys.current(workspaceId, relationId),
    queryFn: () =>
      orpcClient.relationChanges.get({ params: { workspace: workspaceId, id: relationId } }),
    enabled: !!workspaceId && !!relationId
  });

export const invalidateRelationChangeQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  relationId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: relationChangeKeys.current(workspaceId, relationId) }),
    queryClient.invalidateQueries({ queryKey: relationKeys.detail(workspaceId, relationId) }),
    queryClient.invalidateQueries({ queryKey: relationKeys.workspaceLists(workspaceId) })
  ]);

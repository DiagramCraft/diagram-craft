import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { DiscussionObjectType } from '@arch-register/api-types/discussionContract';
import { orpcClient } from '../lib/orpcClient';

export const discussionKeys = {
  all: ['discussions'] as const,
  lists: () => [...discussionKeys.all, 'list'] as const,
  list: (workspaceId: string, objectType: string, objectId: string) =>
    [...discussionKeys.lists(), workspaceId, objectType, objectId] as const,
  summary: (workspaceId: string) => [...discussionKeys.all, 'summary', workspaceId] as const
};

export const discussionsQuery = (
  workspaceId: string,
  objectType: DiscussionObjectType,
  objectId: string,
  enabled = true
) =>
  queryOptions({
    queryKey: discussionKeys.list(workspaceId, objectType, objectId),
    queryFn: () =>
      orpcClient.discussions.list({
        params: { workspace: workspaceId },
        query: { objectType, objectId }
      }),
    enabled: enabled && !!workspaceId && !!objectId
  });

export const discussionSummaryQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: discussionKeys.summary(workspaceId),
    queryFn: () => orpcClient.discussions.summary({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 60_000
  });

export const invalidateDiscussionQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  objectType: string,
  objectId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: discussionKeys.list(workspaceId, objectType, objectId)
    }),
    queryClient.invalidateQueries({ queryKey: discussionKeys.summary(workspaceId) })
  ]);

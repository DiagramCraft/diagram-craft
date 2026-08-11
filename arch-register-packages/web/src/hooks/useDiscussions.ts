import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  discussionSummaryQuery,
  discussionsQuery,
  invalidateDiscussionQueries
} from '../queries/discussions';
import type {
  CreateDiscussionPostRequest,
  DiscussionObjectType,
  UpdateDiscussionPostRequest
} from '@arch-register/api-types/discussionContract';
import { orpcClient } from '../lib/orpcClient';

export const useDiscussions = (
  workspaceId: string,
  objectType: DiscussionObjectType,
  objectId: string,
  enabled = true
) => useQuery(discussionsQuery(workspaceId, objectType, objectId, enabled));

export const useDiscussionSummary = (workspaceId: string, enabled = true) => {
  return useQuery(discussionSummaryQuery(workspaceId, enabled));
};

export const useCreateDiscussionPost = (
  workspaceId: string,
  objectType: DiscussionObjectType,
  objectId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateDiscussionPostRequest) =>
      orpcClient.discussions.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async () =>
      invalidateDiscussionQueries(queryClient, workspaceId, objectType, objectId)
  });
};

export const useUpdateDiscussionPost = (
  workspaceId: string,
  objectType: DiscussionObjectType,
  objectId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: UpdateDiscussionPostRequest }) =>
      orpcClient.discussions.update({ params: { workspace: workspaceId, postId }, body }),
    onSuccess: async () =>
      invalidateDiscussionQueries(queryClient, workspaceId, objectType, objectId)
  });
};

export const useDeleteDiscussionPost = (
  workspaceId: string,
  objectType: DiscussionObjectType,
  objectId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) =>
      orpcClient.discussions.remove({ params: { workspace: workspaceId, postId } }),
    onSuccess: async () =>
      invalidateDiscussionQueries(queryClient, workspaceId, objectType, objectId)
  });
};

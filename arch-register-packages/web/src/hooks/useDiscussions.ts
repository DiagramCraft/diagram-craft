import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { discussionKeys } from './queryKeys';
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
) => {
  return useQuery({
    queryKey: discussionKeys.list(workspaceId, objectType, objectId),
    queryFn: async () =>
      await orpcClient.discussions.list({
        params: { workspace: workspaceId },
        query: { objectType, objectId }
      }),
    enabled: enabled && !!workspaceId && !!objectId
  });
};

export const useDiscussionSummary = (workspaceId: string, enabled = true) => {
  return useQuery({
    queryKey: discussionKeys.summary(workspaceId),
    queryFn: async () => await orpcClient.discussions.summary({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 60_000
  });
};

export const useCreateDiscussionPost = (workspaceId: string, objectType: DiscussionObjectType, objectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateDiscussionPostRequest) =>
      orpcClient.discussions.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: discussionKeys.list(workspaceId, objectType, objectId)
      });
      await queryClient.invalidateQueries({ queryKey: discussionKeys.summary(workspaceId) });
    }
  });
};

export const useUpdateDiscussionPost = (workspaceId: string, objectType: DiscussionObjectType, objectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: UpdateDiscussionPostRequest }) =>
      orpcClient.discussions.update({ params: { workspace: workspaceId, postId }, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: discussionKeys.list(workspaceId, objectType, objectId)
      });
      await queryClient.invalidateQueries({ queryKey: discussionKeys.summary(workspaceId) });
    }
  });
};

export const useDeleteDiscussionPost = (workspaceId: string, objectType: DiscussionObjectType, objectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) =>
      orpcClient.discussions.remove({ params: { workspace: workspaceId, postId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: discussionKeys.list(workspaceId, objectType, objectId)
      });
      await queryClient.invalidateQueries({ queryKey: discussionKeys.summary(workspaceId) });
    }
  });
};

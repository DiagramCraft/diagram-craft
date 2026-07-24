import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wikiCommentKeys } from '../queries/wikiComments';
import type {
  CreateWikiCommentRequest,
  UpdateWikiCommentRequest
} from '@arch-register/api-types/wikiCommentContract';
import { orpcClient } from '../lib/orpcClient';

export const useWikiComments = (workspaceId: string, nodeId: string, enabled = true) => {
  return useQuery({
    queryKey: wikiCommentKeys.list(workspaceId, nodeId),
    queryFn: async () =>
      await orpcClient.wikiComments.list({
        params: { workspace: workspaceId },
        query: { nodeId }
      }),
    enabled: enabled && !!workspaceId && !!nodeId
  });
};

export const useCreateWikiComment = (workspaceId: string, nodeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateWikiCommentRequest) =>
      orpcClient.wikiComments.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wikiCommentKeys.list(workspaceId, nodeId) });
    }
  });
};

export const useUpdateWikiComment = (workspaceId: string, nodeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: UpdateWikiCommentRequest }) =>
      orpcClient.wikiComments.update({ params: { workspace: workspaceId, postId }, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wikiCommentKeys.list(workspaceId, nodeId) });
    }
  });
};

export const useResolveWikiComment = (workspaceId: string, nodeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, resolved }: { postId: string; resolved: boolean }) =>
      orpcClient.wikiComments.resolve({
        params: { workspace: workspaceId, postId },
        body: { resolved }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wikiCommentKeys.list(workspaceId, nodeId) });
    }
  });
};

export const useDeleteWikiComment = (workspaceId: string, nodeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) =>
      orpcClient.wikiComments.remove({ params: { workspace: workspaceId, postId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wikiCommentKeys.list(workspaceId, nodeId) });
    }
  });
};

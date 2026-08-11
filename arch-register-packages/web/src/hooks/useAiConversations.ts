import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import {
  aiConversationsQuery,
  aiKeys as aiKeysFromQueries,
  aiMessagesQuery,
  invalidateAiConversations
} from '../queries/ai';

export const aiKeys = aiKeysFromQueries;

export const useAiConversations = (workspaceSlug: string) => {
  return useQuery(aiConversationsQuery(workspaceSlug));
};

export const useCreateConversation = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) =>
      orpcClient.ai.createConversation({
        params: { workspace: workspaceSlug },
        body: { title }
      }),
    onSuccess: () => {
      invalidateAiConversations(queryClient, workspaceSlug);
    }
  });
};

export const useRenameConversation = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      orpcClient.ai.updateConversation({
        params: { workspace: workspaceSlug, id },
        body: { title }
      }),
    onSuccess: () => {
      invalidateAiConversations(queryClient, workspaceSlug);
    }
  });
};

export const useDeleteConversation = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.ai.deleteConversation({
        params: { workspace: workspaceSlug, id }
      }),
    onSuccess: () => {
      invalidateAiConversations(queryClient, workspaceSlug);
    }
  });
};

export const useConversationMessages = (
  workspaceSlug: string,
  conversationId: string | undefined
) => {
  return useQuery(aiMessagesQuery(workspaceSlug, conversationId));
};

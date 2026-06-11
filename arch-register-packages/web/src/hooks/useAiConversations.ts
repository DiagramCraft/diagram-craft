import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const aiKeys = {
  all: ['ai'] as const,
  conversations: (ws: string) => [...aiKeys.all, 'conversations', ws] as const,
  messages: (ws: string, conversationId: string) =>
    [...aiKeys.all, 'messages', ws, conversationId] as const
};

export const useAiConversations = (workspaceSlug: string) => {
  return useQuery({
    queryKey: aiKeys.conversations(workspaceSlug),
    queryFn: () => orpcClient.ai.listConversations({ params: { workspace: workspaceSlug } }),
    enabled: !!workspaceSlug,
    staleTime: 30_000
  });
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
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations(workspaceSlug) });
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
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations(workspaceSlug) });
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
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations(workspaceSlug) });
    }
  });
};

export const useConversationMessages = (
  workspaceSlug: string,
  conversationId: string | undefined
) => {
  return useQuery({
    queryKey: aiKeys.messages(workspaceSlug, conversationId ?? ''),
    queryFn: () =>
      orpcClient.ai.listMessages({
        params: { workspace: workspaceSlug, id: conversationId! }
      }),
    enabled: !!workspaceSlug && !!conversationId
  });
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { AiConversation } from '@arch-register/api-types/aiContract';

export const aiKeys = {
  all: ['ai'] as const,
  conversations: (ws: string) => [...aiKeys.all, 'conversations', ws] as const,
  messages: (ws: string, conversationId: string) =>
    [...aiKeys.all, 'messages', ws, conversationId] as const
};

export const useAiConversations = (workspaceSlug: string) => {
  return useQuery({
    queryKey: aiKeys.conversations(workspaceSlug),
    queryFn: () => apiFetch<AiConversation[]>(`/api/${workspaceSlug}/ai/conversations`),
    enabled: !!workspaceSlug,
    staleTime: 30_000
  });
};

export const useCreateConversation = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) =>
      apiFetch<AiConversation>(`/api/${workspaceSlug}/ai/conversations`, {
        method: 'POST',
        body: JSON.stringify({ title })
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
      apiFetch<AiConversation>(`/api/${workspaceSlug}/ai/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title })
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
      apiFetch<AiConversation>(`/api/${workspaceSlug}/ai/conversations/${id}`, {
        method: 'DELETE'
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
      apiFetch<Array<{ id: string; role: string; content: string; created_at: string }>>(
        `/api/${workspaceSlug}/ai/conversations/${conversationId}/messages`
      ),
    enabled: !!workspaceSlug && !!conversationId
  });
};

import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { UpsertAiConfigRequest } from '@arch-register/api-types/aiContract';

export const aiConfigKeys = {
  all: ['ai-config'] as const,
  detail: (workspaceId: string) => [...aiConfigKeys.all, workspaceId] as const,
  status: (workspaceId: string) => [...aiConfigKeys.detail(workspaceId), 'status'] as const
};

export const aiKeys = {
  all: ['ai'] as const,
  conversations: (workspaceId: string) => [...aiKeys.all, 'conversations', workspaceId] as const,
  messages: (workspaceId: string, conversationId: string) =>
    [...aiKeys.all, 'messages', workspaceId, conversationId] as const
};

export const aiConfigQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: aiConfigKeys.detail(workspaceId),
    queryFn: () => orpcClient.ai.getConfig({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 60_000
  });

export const aiStatusQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: aiConfigKeys.status(workspaceId),
    queryFn: () => orpcClient.ai.getStatus({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 60_000
  });

export const aiConversationsQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: aiKeys.conversations(workspaceId),
    queryFn: () => orpcClient.ai.listConversations({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId,
    staleTime: 30_000
  });

export const aiMessagesQuery = (workspaceId: string, conversationId: string | undefined) =>
  queryOptions({
    queryKey: aiKeys.messages(workspaceId, conversationId ?? ''),
    queryFn: () =>
      orpcClient.ai.listMessages({
        params: { workspace: workspaceId, id: conversationId! }
      }),
    enabled: !!workspaceId && !!conversationId
  });

export const invalidateAiConfig = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: aiConfigKeys.detail(workspaceId) });

export const invalidateAiConversation = (
  queryClient: QueryClient,
  workspaceId: string,
  conversationId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: aiKeys.conversations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: aiKeys.messages(workspaceId, conversationId) })
  ]);

export const updateAiConfigMutation = (
  queryClient: QueryClient,
  workspaceId: string,
  mutationFn: (data: UpsertAiConfigRequest) => unknown
) => ({
  mutationFn,
  onSuccess: () => invalidateAiConfig(queryClient, workspaceId)
});

export const invalidateAiConversations = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: aiKeys.conversations(workspaceId) });

export const updateAiConversationTitle = <T extends { id: string; title: string }>(
  queryClient: QueryClient,
  workspaceId: string,
  title: string,
  conversationId: string
) => {
  const conversations = queryClient.getQueryData<T[]>(aiKeys.conversations(workspaceId));
  if (
    !conversations?.some(item => item.id === conversationId && item.title === 'New conversation')
  ) {
    return;
  }
  queryClient.setQueryData<T[]>(
    aiKeys.conversations(workspaceId),
    conversations.map(item => (item.id === conversationId ? { ...item, title } : item))
  );
};

export const refreshAiConversation = (
  queryClient: QueryClient,
  workspaceId: string,
  conversationId: string
) => invalidateAiConversation(queryClient, workspaceId, conversationId);

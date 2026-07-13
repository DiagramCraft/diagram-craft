import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { AiConversation } from '@arch-register/api-types/aiContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useAuth } from '../../auth/AuthContext';
import { useAiChat } from '../../hooks/useAiChat';
import {
  aiKeys,
  useAiConversations,
  useConversationMessages,
  useCreateConversation,
  useDeleteConversation,
  useRenameConversation
} from '../../hooks/useAiConversations';
import { asEntityPublicId, entityDetailRoute } from '../../routes/publicObjectRoutes';
import { hasRenderableParts, optimisticConversationTitle } from './assistantViewModel';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/assistant');

export const useAssistantController = () => {
  const { workspaceSlug, teams } = useWorkspaceContext();
  const { user } = useAuth();
  const navigate = routeApi.useNavigate();
  const conversationId = routeApi.useSearch().conversation;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: conversations = [] } = useAiConversations(workspaceSlug);
  const createConversation = useCreateConversation(workspaceSlug);
  const renameConversation = useRenameConversation(workspaceSlug);
  const deleteConversation = useDeleteConversation(workspaceSlug);
  const { data: historicalMessages } = useConversationMessages(workspaceSlug, conversationId);
  const chat = useAiChat(workspaceSlug, conversationId ?? 'new', conversationId);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    if (wasLoadingRef.current && !chat.isLoading && conversationId) {
      void queryClient.invalidateQueries({ queryKey: aiKeys.conversations(workspaceSlug) });
      void queryClient.invalidateQueries({
        queryKey: aiKeys.messages(workspaceSlug, conversationId)
      });
    }
    wasLoadingRef.current = chat.isLoading;
  });

  const visibleMessages = useMemo(() => {
    if (chat.messages.length > 0) {
      return chat.messages.filter(message => hasRenderableParts(message.parts));
    }
    return (historicalMessages ?? []).map(message => ({
      id: message.id,
      role: message.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, content: message.content }],
      createdAt: new Date(message.created_at)
    }));
  }, [chat.messages, historicalMessages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: message count/loading are intentional scroll triggers
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleMessages.length, chat.isLoading]);

  const selectConversation = useCallback(
    (id: string) =>
      navigate({
        to: '/$workspaceSlug/assistant',
        params: { workspaceSlug },
        search: { conversation: id }
      }),
    [navigate, workspaceSlug]
  );
  const navigateToEntity = useCallback(
    (id: string) => {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(id)));
    },
    [navigate, workspaceSlug]
  );
  const respondToApproval = useCallback(
    (id: string, approved: boolean) => {
      void chat.addToolApprovalResponse({ id, approved });
    },
    [chat]
  );
  const handleNew = useCallback(async () => {
    const conversation = await createConversation.mutateAsync(undefined);
    navigate({
      to: '/$workspaceSlug/assistant',
      params: { workspaceSlug },
      search: { conversation: conversation.id }
    });
    chat.clear();
  }, [chat, createConversation, navigate, workspaceSlug]);
  const handleRename = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      if (trimmed) renameConversation.mutate({ id, title: trimmed });
    },
    [renameConversation]
  );
  const handleDelete = useCallback(
    (id: string) => {
      deleteConversation.mutate(id);
      if (id === conversationId) {
        navigate({ to: '/$workspaceSlug/assistant', params: { workspaceSlug } });
        chat.clear();
      }
    },
    [chat, conversationId, deleteConversation, navigate, workspaceSlug]
  );
  const sendMessage = useCallback(
    (text: string) => {
      if (!text || chat.isLoading || !conversationId) return;
      const cached = queryClient.getQueryData<AiConversation[]>(
        aiKeys.conversations(workspaceSlug)
      );
      if (cached?.find(item => item.id === conversationId)?.title === 'New conversation') {
        queryClient.setQueryData<AiConversation[]>(
          aiKeys.conversations(workspaceSlug),
          cached.map(item =>
            item.id === conversationId
              ? { ...item, title: optimisticConversationTitle(text) }
              : item
          )
        );
      }
      chat.sendMessage(text);
    },
    [chat, conversationId, queryClient, workspaceSlug]
  );
  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft('');
  }, [draft, sendMessage]);
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return {
    teams,
    user,
    conversations,
    conversationId,
    chat,
    visibleMessages,
    draft,
    setDraft,
    scrollRef,
    isEmpty: visibleMessages.length === 0,
    selectConversation,
    navigateToEntity,
    respondToApproval,
    handleNew,
    handleRename,
    handleDelete,
    sendMessage,
    submit,
    onKeyDown
  };
};

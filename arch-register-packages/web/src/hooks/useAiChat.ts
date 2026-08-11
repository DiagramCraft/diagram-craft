import { useMemo } from 'react';
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react';
import type { UIMessage } from '@tanstack/ai-react';
import { resolveApiUrl } from '../lib/apiUrl';

export const useAiChat = (
  workspaceSlug: string,
  sessionId?: string,
  conversationId?: string,
  initialMessages?: UIMessage[]
) => {
  const url = resolveApiUrl(`/api/application/v1/${encodeURIComponent(workspaceSlug)}/ai/chat`);

  const connection = useMemo(
    () =>
      fetchServerSentEvents(url, {
        credentials: 'include' as RequestCredentials
      }),
    [url]
  );

  return useChat({
    id: sessionId ?? 'new',
    connection,
    forwardedProps: conversationId ? { conversationId } : undefined,
    initialMessages
  });
};

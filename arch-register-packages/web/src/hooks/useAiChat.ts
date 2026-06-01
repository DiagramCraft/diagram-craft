import { useChat, fetchServerSentEvents } from '@tanstack/ai-react';

const BASE = import.meta.env.VITE_API_URL ?? '';

export const useAiChat = (workspaceSlug: string, conversationId?: string) => {
  const url = `${BASE}/api/${workspaceSlug}/ai/chat`;

  return useChat({
    connection: fetchServerSentEvents(url, () => ({
      credentials: 'include' as RequestCredentials,
    })),
    body: conversationId ? { conversationId } : undefined,
  });
};

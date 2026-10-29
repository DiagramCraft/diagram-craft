import { useMemo } from 'react';
import { toolDefinition } from '@tanstack/ai';
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react';
import type { UIMessage } from '@tanstack/ai-react';
import {
  createEntityChatToolInputSchema,
  createRelationChatToolInputSchema,
  deleteRelationChatToolInputSchema,
  updateEntityChatToolInputSchema,
  updateRelationChatToolInputSchema
} from '@arch-register/api-types/aiChatApprovalToolSchemas';
import { resolveApiUrl } from '../lib/apiUrl';

const approvalTools = [
  toolDefinition({
    name: 'create_entity',
    description: 'Create an entity after user approval.',
    needsApproval: true,
    inputSchema: createEntityChatToolInputSchema
  }),
  toolDefinition({
    name: 'update_entity',
    description: 'Update an entity after user approval.',
    needsApproval: true,
    inputSchema: updateEntityChatToolInputSchema
  }),
  toolDefinition({
    name: 'create_relation',
    description: 'Create a relation after user approval.',
    needsApproval: true,
    inputSchema: createRelationChatToolInputSchema
  }),
  toolDefinition({
    name: 'update_relation',
    description: 'Update a relation after user approval.',
    needsApproval: true,
    inputSchema: updateRelationChatToolInputSchema
  }),
  toolDefinition({
    name: 'delete_relation',
    description: 'Delete a relation after user approval.',
    needsApproval: true,
    inputSchema: deleteRelationChatToolInputSchema
  })
] as const;

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

  return useChat<typeof approvalTools>({
    threadId: sessionId ?? 'new',
    connection,
    tools: approvalTools,
    forwardedProps: conversationId ? { conversationId } : undefined,
    initialMessages
  });
};

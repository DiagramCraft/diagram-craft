import { oc, eventIterator } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';

const aiConversationSchema = z.object({
  id: z.string().describe('Unique conversation identifier'),
  workspace: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User who owns the conversation'),
  title: z.string().describe('Conversation title'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const aiProviderSchema = z.enum(['openrouter', 'openai']).describe('AI provider type');

const aiMessagePartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }).passthrough(),
  z.object({ type: z.literal('image') }).passthrough(),
  z.object({ type: z.literal('audio') }).passthrough(),
  z.object({ type: z.literal('video') }).passthrough(),
  z.object({ type: z.literal('document') }).passthrough(),
  z
    .object({
      type: z.literal('tool-call'),
      id: z.string(),
      name: z.string(),
      arguments: z.string(),
      state: z.string()
    })
    .passthrough(),
  z
    .object({
      type: z.literal('tool-result'),
      toolCallId: z.string(),
      content: z.union([z.string(), z.array(z.unknown())]),
      state: z.string()
    })
    .passthrough(),
  z.object({ type: z.literal('thinking'), content: z.string() }).passthrough(),
  z
    .object({
      type: z.literal('structured-output'),
      status: z.enum(['streaming', 'complete', 'error']),
      raw: z.string()
    })
    .passthrough(),
  z
    .object({
      type: z.literal('ui-resource'),
      resource: z.object({ uri: z.string(), mimeType: z.string() }).passthrough(),
      toolCallId: z.string(),
      toolName: z.string()
    })
    .passthrough()
]);

const aiModelMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'tool']),
    content: z.union([z.string(), z.null(), z.array(aiMessagePartSchema)]),
    name: z.string().optional(),
    toolCalls: z.array(z.unknown()).optional(),
    toolCallId: z.string().optional(),
    thinking: z
      .array(z.object({ content: z.string(), signature: z.string().optional() }))
      .optional()
  })
  .passthrough();

const aiUiMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(['system', 'user', 'assistant']),
    parts: z.array(aiMessagePartSchema),
    createdAt: z.union([z.string(), z.date()]).optional()
  })
  .passthrough();

export const aiChatMessageSchema = z.union([aiModelMessageSchema, aiUiMessageSchema]);

const aiMessageSchema = z.object({
  id: z.string().describe('Unique message identifier'),
  conversation_id: z.string().describe('Parent conversation identifier'),
  role: z.enum(['system', 'user', 'assistant']).describe('Message role'),
  content: z.string().describe('Message content'),
  metadata: z.record(z.string(), z.unknown()).describe('Additional message metadata'),
  created_at: z.string().describe('ISO 8601 creation timestamp')
});

const aiConfigSchema = z.object({
  workspace: z.string().describe('Workspace identifier'),
  provider: aiProviderSchema.describe('AI provider (openrouter or openai)'),
  base_url: z.string().nullable().describe('Custom API base URL (null for default)'),
  model: z.string().nullable().describe('AI model identifier (null for default)'),
  temperature: z
    .number()
    .nullable()
    .describe('Temperature parameter for generation (0-2, null for default)'),
  system_prompt: z.string().nullable().describe('Custom system prompt (null for default)'),
  enabled: z.boolean().describe('Whether AI features are enabled'),
  has_api_key: z.boolean().describe('Whether an API key is configured'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const aiConfigUpdateSchema = z.object({
  provider: aiProviderSchema.optional().describe('AI provider to use'),
  api_key: z.string().nullable().optional().describe('API key for the provider (null to clear)'),
  base_url: z.string().nullable().optional().describe('Custom API base URL (null for default)'),
  model: z.string().nullable().optional().describe('AI model identifier (null for default)'),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .nullable()
    .optional()
    .describe('Temperature parameter (0-2, null for default)'),
  system_prompt: z
    .string()
    .nullable()
    .optional()
    .describe('Custom system prompt (null for default)'),
  enabled: z.boolean().optional().describe('Enable or disable AI features')
});

// ── Contract ──────────────────────────────────────────────────

export const aiContract = oc.tag('AI').router({
  ai: {
    listConversations: oc
      .route({
        method: 'GET',
        path: '/{workspace}/ai/conversations',
        inputStructure: 'detailed',
        summary: 'List AI conversations',
        description: 'Retrieves all AI conversations for the current user in the workspace.',
        tags: ['AI']
      })
      .input(z.object({ params: ws }))
      .output(z.array(aiConversationSchema)),
    createConversation: oc
      .route({
        method: 'POST',
        path: '/{workspace}/ai/conversations',
        inputStructure: 'detailed',
        summary: 'Create AI conversation',
        description: 'Creates a new AI conversation with an optional title.',
        tags: ['AI']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            title: z
              .string()
              .optional()
              .describe('Conversation title (auto-generated if not provided)')
          })
        })
      )
      .output(aiConversationSchema),
    updateConversation: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/ai/conversations/{id}',
        inputStructure: 'detailed',
        summary: 'Update AI conversation',
        description: 'Updates the title of an existing AI conversation.',
        tags: ['AI']
      })
      .input(
        z.object({
          params: wsAndUUID,
          body: z.object({ title: z.string().describe('New conversation title') })
        })
      )
      .output(aiConversationSchema),
    deleteConversation: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/ai/conversations/{id}',
        inputStructure: 'detailed',
        summary: 'Delete AI conversation',
        description:
          'Deletes an AI conversation and all its messages. This operation cannot be undone.',
        tags: ['AI']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(aiConversationSchema),
    listMessages: oc
      .route({
        method: 'GET',
        path: '/{workspace}/ai/conversations/{id}/messages',
        inputStructure: 'detailed',
        summary: 'List conversation messages',
        description: 'Retrieves all messages in an AI conversation, ordered chronologically.',
        tags: ['AI']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(z.array(aiMessageSchema)),
    getStatus: oc
      .route({
        method: 'GET',
        path: '/{workspace}/ai/status',
        inputStructure: 'detailed',
        summary: 'Get AI status',
        description:
          'Reports whether AI is actively and validly configured for the workspace, without exposing configuration details. Available to any workspace viewer.',
        tags: ['AI']
      })
      .input(z.object({ params: ws }))
      .output(z.object({ configured: z.boolean().describe('Whether AI is active and usable') })),
    getConfig: oc
      .route({
        method: 'GET',
        path: '/{workspace}/ai/config',
        inputStructure: 'detailed',
        summary: 'Get AI configuration',
        description:
          'Retrieves the AI configuration for the workspace, including provider settings and enabled status.',
        tags: ['AI']
      })
      .input(z.object({ params: ws }))
      .output(aiConfigSchema),
    updateConfig: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/ai/config',
        inputStructure: 'detailed',
        summary: 'Update AI configuration',
        description:
          'Updates the AI configuration for the workspace, including provider, API key, model, and other settings.',
        tags: ['AI']
      })
      .input(
        z.object({
          params: ws,
          body: aiConfigUpdateSchema
        })
      )
      .output(aiConfigSchema),
    extract: oc
      .route({
        method: 'POST',
        path: '/{workspace}/ai/extract',
        inputStructure: 'detailed',
        summary: 'Extract entities from text',
        description:
          'Uses AI to extract structured entity data from unstructured text. Returns a list of potential entities.',
        tags: ['AI']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({ text: z.string().describe('Text to extract entities from') })
        })
      )
      .output(
        z.object({
          entities: z.array(z.unknown()).describe('Extracted entity data'),
          raw: z.string().optional().describe('Raw AI response')
        })
      ),
    chat: oc
      .route({
        method: 'POST',
        path: '/{workspace}/ai/chat',
        inputStructure: 'detailed',
        summary: 'Chat with AI',
        description:
          'Sends a message to the AI and receives a streaming response. Supports conversation context and custom state.',
        tags: ['AI']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            messages: z.array(aiChatMessageSchema).describe('TanStack AI model or UI messages'),
            threadId: z.string().optional().describe('Thread identifier for context'),
            runId: z.string().optional().describe('Run identifier'),
            parentRunId: z.string().optional().describe('Parent run identifier'),
            conversationId: z.string().optional().describe('Conversation identifier'),
            forwardedProps: z
              .record(z.string(), z.unknown())
              .optional()
              .describe('Additional properties'),
            state: z.unknown().optional().describe('Custom state data'),
            context: z.array(z.unknown()).optional().describe('Additional context for the AI')
          })
        })
      )
      .output(eventIterator(z.unknown()))
  }
});

// ── Exported Types ───────────────────────────────────────────

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;
export type WorkspaceAiConfig = z.infer<typeof aiConfigSchema>;
export type UpsertAiConfigRequest = z.infer<typeof aiConfigUpdateSchema>;
export type AiConversation = z.infer<typeof aiConversationSchema>;

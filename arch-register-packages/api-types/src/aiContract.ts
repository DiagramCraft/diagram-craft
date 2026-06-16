import { oc, eventIterator } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';

const aiConversationSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  user_id: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

const aiProviderSchema = z.enum(['openrouter', 'openai']);

const aiMessageSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string()
});

const aiConfigSchema = z.object({
  workspace: z.string(),
  provider: aiProviderSchema,
  base_url: z.string().nullable(),
  model: z.string().nullable(),
  temperature: z.number().nullable(),
  system_prompt: z.string().nullable(),
  enabled: z.boolean(),
  has_api_key: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

const aiConfigUpdateSchema = z.object({
  provider: aiProviderSchema.optional(),
  api_key: z.string().nullable().optional(),
  base_url: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  system_prompt: z.string().nullable().optional(),
  enabled: z.boolean().optional()
});

// ── Contract ──────────────────────────────────────────────────

export const aiContract = {
  ai: {
    listConversations: oc
      .route({ method: 'GET', path: '/{workspace}/ai/conversations', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(z.array(aiConversationSchema)),
    createConversation: oc
      .route({ method: 'POST', path: '/{workspace}/ai/conversations', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({ title: z.string().optional() })
        })
      )
      .output(aiConversationSchema),
    updateConversation: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/ai/conversations/{id}',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndUUID,
          body: z.object({ title: z.string() })
        })
      )
      .output(aiConversationSchema),
    deleteConversation: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/ai/conversations/{id}',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: wsAndUUID }))
      .output(aiConversationSchema),
    listMessages: oc
      .route({
        method: 'GET',
        path: '/{workspace}/ai/conversations/{id}/messages',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: wsAndUUID }))
      .output(z.array(aiMessageSchema)),
    getConfig: oc
      .route({ method: 'GET', path: '/{workspace}/ai/config', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(aiConfigSchema),
    updateConfig: oc
      .route({ method: 'PUT', path: '/{workspace}/ai/config', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: aiConfigUpdateSchema
        })
      )
      .output(aiConfigSchema),
    extract: oc
      .route({ method: 'POST', path: '/{workspace}/ai/extract', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({ text: z.string() })
        })
      )
      .output(
        z.object({
          entities: z.array(z.unknown()),
          raw: z.string().optional()
        })
      ),
    chat: oc
      .route({ method: 'POST', path: '/{workspace}/ai/chat', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({
            messages: z.array(z.unknown()),
            threadId: z.string().optional(),
            runId: z.string().optional(),
            parentRunId: z.string().optional(),
            conversationId: z.string().optional(),
            forwardedProps: z.record(z.string(), z.unknown()).optional(),
            state: z.unknown().optional(),
            context: z.array(z.unknown()).optional()
          })
        })
      )
      .output(eventIterator(z.unknown()))
  }
};

// ── Exported Types ───────────────────────────────────────────

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type WorkspaceAiConfig = z.infer<typeof aiConfigSchema>;
export type UpsertAiConfigRequest = z.infer<typeof aiConfigUpdateSchema>;
export type AiConversation = z.infer<typeof aiConversationSchema>;

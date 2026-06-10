import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

export const aiConversationSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  user_id: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

export const aiMessageSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string()
});

const aiConfigSchema = z.object({
  workspace: z.string(),
  provider: z.enum(['openrouter', 'openai']),
  base_url: z.string().nullable(),
  model: z.string().nullable(),
  temperature: z.number().nullable(),
  system_prompt: z.string().nullable(),
  enabled: z.boolean(),
  has_api_key: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable()
});

// ── Contract ──────────────────────────────────────────────────

export const aiContract = {
  ai: {
    listConversations: oc
      .route({ method: 'GET', path: '/{workspace}/ai/conversations' })
      .input(z.object({ workspace: z.string() }))
      .output(z.array(aiConversationSchema)),
    createConversation: oc
      .route({ method: 'POST', path: '/{workspace}/ai/conversations' })
      .input(z.object({ workspace: z.string(), title: z.string().optional() }))
      .output(aiConversationSchema),
    updateConversation: oc
      .route({ method: 'PATCH', path: '/{workspace}/ai/conversations/{conversationId}' })
      .input(z.object({ workspace: z.string(), conversationId: z.string(), title: z.string() }))
      .output(aiConversationSchema),
    deleteConversation: oc
      .route({ method: 'DELETE', path: '/{workspace}/ai/conversations/{conversationId}' })
      .input(z.object({ workspace: z.string(), conversationId: z.string() }))
      .output(aiConversationSchema),
    listMessages: oc
      .route({ method: 'GET', path: '/{workspace}/ai/conversations/{conversationId}/messages' })
      .input(z.object({ workspace: z.string(), conversationId: z.string() }))
      .output(z.array(aiMessageSchema)),
    getConfig: oc
      .route({ method: 'GET', path: '/{workspace}/ai/config' })
      .input(z.object({ workspace: z.string() }))
      .output(aiConfigSchema),
    updateConfig: oc
      .route({ method: 'PUT', path: '/{workspace}/ai/config' })
      .input(
        z.object({
          workspace: z.string(),
          provider: z.enum(['openrouter', 'openai']).optional(),
          api_key: z.string().nullable().optional(),
          base_url: z.string().nullable().optional(),
          model: z.string().nullable().optional(),
          temperature: z.number().min(0).max(2).nullable().optional(),
          system_prompt: z.string().nullable().optional(),
          enabled: z.boolean().optional()
        })
      )
      .output(aiConfigSchema),
    extract: oc
      .route({ method: 'POST', path: '/{workspace}/ai/extract' })
      .input(z.object({ workspace: z.string(), text: z.string() }))
      .output(
        z.object({
          entities: z.array(z.unknown()),
          raw: z.string().optional()
        })
      )
  }
};

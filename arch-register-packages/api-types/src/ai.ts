import type { z } from 'zod';
import type { aiConversationSchema, aiMessageSchema } from './aiContract.js';

export type AiProvider = 'openrouter' | 'openai';

export type WorkspaceAiConfig = {
  workspace: string;
  provider: AiProvider;
  base_url: string | null;
  model: string | null;
  temperature: number | null;
  system_prompt: string | null;
  enabled: boolean;
  has_api_key: boolean;
  created_at: string;
  updated_at: string;
};

export type UpsertAiConfigRequest = {
  provider?: AiProvider;
  api_key?: string;
  base_url?: string | null;
  model?: string | null;
  temperature?: number | null;
  system_prompt?: string | null;
  enabled?: boolean;
};

export type AiConversation = z.infer<typeof aiConversationSchema>;

export type AiMessageRecord = z.infer<typeof aiMessageSchema>;

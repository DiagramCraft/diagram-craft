import type { z } from 'zod';
import {
  aiConfigSchema,
  aiConfigUpdateSchema,
  aiConversationSchema,
  aiMessageSchema
} from './aiContract.js';

export type AiProvider = 'openrouter' | 'openai';

export type WorkspaceAiConfig = z.infer<typeof aiConfigSchema>;

export type UpsertAiConfigRequest = z.infer<typeof aiConfigUpdateSchema>;

export type AiConversation = z.infer<typeof aiConversationSchema>;

export type AiMessageRecord = z.infer<typeof aiMessageSchema>;

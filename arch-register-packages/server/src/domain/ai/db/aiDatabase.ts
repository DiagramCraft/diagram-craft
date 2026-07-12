export type AiConfigDbResult = {
  workspace: string;
  provider: AiProvider;
  api_key_enc: string | null;
  base_url: string | null;
  model: string | null;
  temperature: number | null;
  system_prompt: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

type AiProvider = 'openrouter' | 'openai';

export type AiConfigInputDbUpsert = {
  provider?: string;
  api_key_enc?: string | null;
  base_url?: string | null;
  model?: string | null;
  temperature?: number | null;
  system_prompt?: string | null;
  enabled?: boolean;
};

export type AiConversationDbCreate = {
  id: string;
  workspace: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

export type AiConversationDbResult = {
  id: string;
  workspace: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

export type AiMessageDbResult = {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};
export type AiMessageDbCreate = {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export const aiMappers = {
  config: (row: DatabaseRow): AiConfigDbResult => ({
    workspace: String(row['workspace']),
    provider: String(row['provider']) as AiConfigDbResult['provider'],
    api_key_enc: row['api_key_enc'] == null ? null : String(row['api_key_enc']),
    base_url: row['base_url'] == null ? null : String(row['base_url']),
    model: row['model'] == null ? null : String(row['model']),
    temperature: row['temperature'] == null ? null : Number(row['temperature']),
    system_prompt: row['system_prompt'] == null ? null : String(row['system_prompt']),
    enabled: databaseBoolean(row['enabled']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  conversation: (row: DatabaseRow): AiConversationDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    user_id: String(row['user_id']),
    title: String(row['title']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  message: (row: DatabaseRow): AiMessageDbResult => ({
    id: String(row['id']),
    conversation_id: String(row['conversation_id']),
    role: String(row['role']) as AiMessageDbResult['role'],
    content: String(row['content']),
    metadata: parseDatabaseJson(row['metadata'], {}, 'ai_message.metadata'),
    created_at: databaseDate(row['created_at'])
  })
};

export type AiDatabase = {
  getAiConfig(ws: string): Promise<AiConfigDbResult | null>;
  upsertAiConfig(ws: string, input: AiConfigInputDbUpsert): Promise<AiConfigDbResult>;

  listConversations(ws: string, userId: string): Promise<AiConversationDbResult[]>;
  getConversation(ws: string, id: string): Promise<AiConversationDbResult | null>;
  createConversation(input: AiConversationDbCreate): Promise<AiConversationDbResult>;
  updateConversationTitle(
    ws: string,
    id: string,
    title: string
  ): Promise<AiConversationDbResult | null>;
  initConversationTitle(ws: string, id: string, title: string): Promise<void>;
  deleteConversation(ws: string, id: string): Promise<AiConversationDbResult | null>;

  listMessages(conversationId: string): Promise<AiMessageDbResult[]>;
  createMessage(input: AiMessageDbCreate): Promise<AiMessageDbResult>;
};
import { databaseBoolean, databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

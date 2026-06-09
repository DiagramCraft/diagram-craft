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

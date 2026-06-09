export type WorkspaceAiConfig = {
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

export type UpsertAiConfigInput = {
  provider?: string;
  api_key_enc?: string | null;
  base_url?: string | null;
  model?: string | null;
  temperature?: number | null;
  system_prompt?: string | null;
  enabled?: boolean;
};

export type CreateConversationInput = {
  id: string;
  workspace: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

export type AiConversation = {
  id: string;
  workspace: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};
export type CreateMessageInput = {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export type AiDatabase = {
  getAiConfig(ws: string): Promise<WorkspaceAiConfig | null>;
  upsertAiConfig(ws: string, input: UpsertAiConfigInput): Promise<WorkspaceAiConfig>;

  listConversations(ws: string, userId: string): Promise<AiConversation[]>;
  getConversation(ws: string, id: string): Promise<AiConversation | null>;
  createConversation(input: CreateConversationInput): Promise<AiConversation>;
  updateConversationTitle(ws: string, id: string, title: string): Promise<AiConversation | null>;
  initConversationTitle(ws: string, id: string, title: string): Promise<void>;
  deleteConversation(ws: string, id: string): Promise<AiConversation | null>;

  listMessages(conversationId: string): Promise<AiMessage[]>;
  createMessage(input: CreateMessageInput): Promise<AiMessage>;
};

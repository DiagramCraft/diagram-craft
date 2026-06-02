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

export type AiConversation = {
  id: string;
  workspace: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AiMessageRecord = {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

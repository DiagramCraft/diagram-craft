import { createOpenRouterText, openRouterText } from '@tanstack/ai-openrouter';
import { createOpenaiChat, openaiText } from '@tanstack/ai-openai';
import { decrypt } from '../../utils/encryption';
import type { DatabaseAdapter } from '../../db/database';
import { AiProvider } from '@arch-register/api-types/aiContract';

export type EffectiveAiConfig = {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string | null;
  model: string;
  temperature: number;
  systemPrompt: string | null;
};

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4-20250514';
const DEFAULT_OPENAI_MODEL = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.7;

export const resolveAiConfig = async (
  db: DatabaseAdapter,
  workspaceId: string
): Promise<EffectiveAiConfig | null> => {
  const wsConfig = await db.ai.getAiConfig(workspaceId);
  if (wsConfig?.enabled === false) return null;
  const provider = (wsConfig?.provider ?? 'openrouter') as AiProvider;

  const apiKey = wsConfig?.api_key_enc
    ? decrypt(wsConfig.api_key_enc)
    : provider === 'openai'
      ? process.env['OPENAI_API_KEY']
      : process.env['OPENROUTER_API_KEY'];

  if (!apiKey) return null;

  const defaultModel = provider === 'openai' ? DEFAULT_OPENAI_MODEL : DEFAULT_OPENROUTER_MODEL;

  return {
    provider,
    apiKey,
    baseUrl:
      wsConfig?.base_url ??
      (provider === 'openai' ? (process.env['OPENAI_BASE_URL'] ?? null) : null),
    model:
      wsConfig?.model ??
      (provider === 'openai' ? process.env['OPENAI_MODEL'] : process.env['OPENROUTER_MODEL']) ??
      defaultModel,
    temperature: wsConfig?.temperature ?? DEFAULT_TEMPERATURE,
    systemPrompt: wsConfig?.system_prompt ?? null
  };
};

export const createAiTextAdapter = (config: EffectiveAiConfig) => {
  if (config.provider === 'openai') {
    if (config.apiKey === process.env['OPENAI_API_KEY']) {
      return openaiText(config.model as Parameters<typeof openaiText>[0], {
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {})
      });
    }
    return createOpenaiChat(config.model as Parameters<typeof createOpenaiChat>[0], config.apiKey, {
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {})
    });
  }

  // OpenRouter (default)
  if (config.apiKey === process.env['OPENROUTER_API_KEY']) {
    return openRouterText(config.model as Parameters<typeof openRouterText>[0]);
  }
  return createOpenRouterText(
    config.model as Parameters<typeof createOpenRouterText>[0],
    config.apiKey
  );
};

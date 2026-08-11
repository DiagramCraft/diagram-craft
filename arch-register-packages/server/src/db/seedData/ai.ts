import type { AiConfigInputDbUpsert } from '../../domain/ai/db/aiDatabase';

export const seedAiConfig: AiConfigInputDbUpsert = {
  provider: 'openrouter',
  api_key_enc: null,
  base_url: null,
  model: null,
  temperature: null,
  system_prompt: null,
  enabled: false
};

import type { AiConfigInputDbUpsert } from '../domain/ai/db/aiDatabase';
import { encrypt, getEncryptionKeyMaterial } from '../utils/encryption';

const BOOTSTRAP_AI_ENV_NAMES = [
  'BOOTSTRAP_AI_PROVIDER',
  'BOOTSTRAP_AI_MODEL',
  'BOOTSTRAP_AI_API_KEY'
] as const;

export const hasBootstrapAiFlag = (args: readonly string[]): boolean =>
  args.includes('--bootstrap-ai');

export const resolveBootstrapAiConfig = (
  env: NodeJS.ProcessEnv = process.env
): AiConfigInputDbUpsert => {
  const missing = BOOTSTRAP_AI_ENV_NAMES.filter(name => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `--bootstrap-ai requires ${BOOTSTRAP_AI_ENV_NAMES.join(', ')}; missing ${missing.join(', ')}`
    );
  }

  const provider = env['BOOTSTRAP_AI_PROVIDER']!;
  if (provider !== 'openrouter' && provider !== 'openai') {
    throw new Error(`BOOTSTRAP_AI_PROVIDER must be "openrouter" or "openai", got "${provider}"`);
  }

  if (!getEncryptionKeyMaterial()) {
    throw new Error('--bootstrap-ai requires AI_ENCRYPTION_KEY to persist the API key');
  }

  return {
    provider,
    api_key_enc: encrypt(env['BOOTSTRAP_AI_API_KEY']!),
    model: env['BOOTSTRAP_AI_MODEL']!,
    base_url: null,
    temperature: null,
    system_prompt: null,
    enabled: true
  };
};

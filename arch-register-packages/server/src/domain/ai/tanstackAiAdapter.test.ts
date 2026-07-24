import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { resolveAiConfig } from './tanstackAiAdapter';

vi.mock('../../utils/encryption', () => ({
  decrypt: vi.fn(() => 'decrypted-key')
}));

const baseConfig = {
  workspace: 'ws-1',
  provider: 'openrouter' as const,
  api_key_enc: 'encrypted' as string | null,
  base_url: null,
  model: null,
  temperature: null,
  system_prompt: null,
  enabled: true,
  created_at: new Date(),
  updated_at: new Date()
};

const makeDb = (config: typeof baseConfig | null) =>
  ({
    ai: {
      getAiConfig: vi.fn(async () => config)
    }
  }) as unknown as DatabaseAdapter;

describe('resolveAiConfig', () => {
  beforeEach(() => {
    delete process.env['OPENROUTER_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
  });

  it('resolves an effective config when a workspace config is enabled with an api key', async () => {
    const db = makeDb(baseConfig);

    const result = await resolveAiConfig(db, 'ws-1');

    expect(result).not.toBeNull();
    expect(result?.apiKey).toBe('decrypted-key');
  });

  it('returns null when the workspace config is explicitly disabled, even with an api key', async () => {
    const db = makeDb({ ...baseConfig, enabled: false });

    const result = await resolveAiConfig(db, 'ws-1');

    expect(result).toBeNull();
  });

  it('returns null when no api key is available from config or environment', async () => {
    const db = makeDb({ ...baseConfig, api_key_enc: null });

    const result = await resolveAiConfig(db, 'ws-1');

    expect(result).toBeNull();
  });

  it('falls back to an environment api key when no workspace config exists', async () => {
    process.env['OPENROUTER_API_KEY'] = 'env-key';
    const db = makeDb(null);

    const result = await resolveAiConfig(db, 'ws-1');

    expect(result?.apiKey).toBe('env-key');
  });
});

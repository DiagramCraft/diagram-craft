import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { createAiTextAdapter, resolveAiConfig, type EffectiveAiConfig } from './tanstackAiAdapter';

const adapterMocks = vi.hoisted(() => ({
  openRouterText: vi.fn((model: string) => ({ provider: 'openrouter-env', model })),
  createOpenRouterText: vi.fn((model: string, apiKey: string) => ({
    provider: 'openrouter-workspace',
    model,
    apiKey
  })),
  openaiText: vi.fn((model: string, options?: Record<string, unknown>) => ({
    provider: 'openai-env',
    model,
    options
  })),
  createOpenaiChat: vi.fn((model: string, apiKey: string, options?: Record<string, unknown>) => ({
    provider: 'openai-workspace',
    model,
    apiKey,
    options
  }))
}));

vi.mock('@tanstack/ai-openrouter', () => adapterMocks);
vi.mock('@tanstack/ai-openai', () => adapterMocks);

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
    adapterMocks.openRouterText.mockClear();
    adapterMocks.createOpenRouterText.mockClear();
    adapterMocks.openaiText.mockClear();
    adapterMocks.createOpenaiChat.mockClear();
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

const makeEffectiveConfig = (overrides: Partial<EffectiveAiConfig> = {}): EffectiveAiConfig => ({
  provider: 'openai',
  apiKey: 'workspace-key',
  baseUrl: 'http://localhost:1234/v1',
  model: 'configured-model',
  temperature: 0.7,
  systemPrompt: null,
  ...overrides
});

describe('createAiTextAdapter', () => {
  it('uses the environment OpenAI adapter with the configured model and base URL', () => {
    process.env['OPENAI_API_KEY'] = 'env-key';

    const adapter = createAiTextAdapter(
      makeEffectiveConfig({ apiKey: 'env-key', provider: 'openai' })
    );

    expect(adapterMocks.openaiText).toHaveBeenCalledWith('configured-model', {
      baseURL: 'http://localhost:1234/v1'
    });
    expect(adapter).toEqual({
      provider: 'openai-env',
      model: 'configured-model',
      options: { baseURL: 'http://localhost:1234/v1' }
    });
  });

  it('uses the workspace OpenAI adapter with the configured credentials', () => {
    const adapter = createAiTextAdapter(makeEffectiveConfig({ provider: 'openai' }));

    expect(adapterMocks.createOpenaiChat).toHaveBeenCalledWith(
      'configured-model',
      'workspace-key',
      { baseURL: 'http://localhost:1234/v1' }
    );
    expect(adapter).toEqual({
      provider: 'openai-workspace',
      model: 'configured-model',
      apiKey: 'workspace-key',
      options: { baseURL: 'http://localhost:1234/v1' }
    });
  });

  it('uses the environment OpenRouter adapter when the environment key is selected', () => {
    process.env['OPENROUTER_API_KEY'] = 'env-key';

    const adapter = createAiTextAdapter(
      makeEffectiveConfig({ provider: 'openrouter', apiKey: 'env-key', model: 'router-model' })
    );

    expect(adapterMocks.openRouterText).toHaveBeenCalledWith('router-model');
    expect(adapter).toEqual({ provider: 'openrouter-env', model: 'router-model' });
  });

  it('uses the workspace OpenRouter adapter when a workspace key is configured', () => {
    const adapter = createAiTextAdapter(
      makeEffectiveConfig({ provider: 'openrouter', model: 'router-model' })
    );

    expect(adapterMocks.createOpenRouterText).toHaveBeenCalledWith('router-model', 'workspace-key');
    expect(adapter).toEqual({
      provider: 'openrouter-workspace',
      model: 'router-model',
      apiKey: 'workspace-key'
    });
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decrypt } from '../utils/encryption';
import { hasBootstrapAiFlag, resolveBootstrapAiConfig } from './bootstrapAi';

const bootstrapEnvNames = [
  'BOOTSTRAP_AI_PROVIDER',
  'BOOTSTRAP_AI_MODEL',
  'BOOTSTRAP_AI_API_KEY',
  'AI_ENCRYPTION_KEY'
] as const;

const originalEnv = Object.fromEntries(
  bootstrapEnvNames.map(name => [name, process.env[name]])
) as Record<(typeof bootstrapEnvNames)[number], string | undefined>;

beforeEach(() => {
  for (const name of bootstrapEnvNames) delete process.env[name];
});

afterEach(() => {
  for (const name of bootstrapEnvNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('hasBootstrapAiFlag', () => {
  it('recognizes the bootstrap AI switch', () => {
    expect(hasBootstrapAiFlag(['--bootstrap-ai'])).toBe(true);
    expect(hasBootstrapAiFlag([])).toBe(false);
  });
});

describe('resolveBootstrapAiConfig', () => {
  it('requires all bootstrap AI variables', () => {
    expect(() => resolveBootstrapAiConfig()).toThrow(
      'missing BOOTSTRAP_AI_PROVIDER, BOOTSTRAP_AI_MODEL, BOOTSTRAP_AI_API_KEY'
    );
  });

  it('rejects unsupported providers', () => {
    process.env['BOOTSTRAP_AI_PROVIDER'] = 'unsupported';
    process.env['BOOTSTRAP_AI_MODEL'] = 'model';
    process.env['BOOTSTRAP_AI_API_KEY'] = 'api-key';
    process.env['AI_ENCRYPTION_KEY'] = 'encryption-key';

    expect(() => resolveBootstrapAiConfig()).toThrow(
      'BOOTSTRAP_AI_PROVIDER must be "openrouter" or "openai"'
    );
  });

  it('requires encryption before persisting the API key', () => {
    process.env['BOOTSTRAP_AI_PROVIDER'] = 'openrouter';
    process.env['BOOTSTRAP_AI_MODEL'] = 'model';
    process.env['BOOTSTRAP_AI_API_KEY'] = 'api-key';

    expect(() => resolveBootstrapAiConfig()).toThrow('--bootstrap-ai requires AI_ENCRYPTION_KEY');
  });

  it('returns an enabled configuration with an encrypted API key', () => {
    process.env['BOOTSTRAP_AI_PROVIDER'] = 'openai';
    process.env['BOOTSTRAP_AI_MODEL'] = 'gpt-test';
    process.env['BOOTSTRAP_AI_API_KEY'] = 'api-key';
    process.env['AI_ENCRYPTION_KEY'] = 'encryption-key';

    const config = resolveBootstrapAiConfig();

    expect(config).toMatchObject({
      provider: 'openai',
      model: 'gpt-test',
      enabled: true,
      base_url: null,
      temperature: null,
      system_prompt: null
    });
    expect(config.api_key_enc).toMatch(/^v1:/);
    expect(decrypt(config.api_key_enc!)).toBe('api-key');
  });
});

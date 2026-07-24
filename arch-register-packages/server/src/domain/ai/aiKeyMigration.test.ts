import { createCipheriv, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AiConfigDbResult } from './db/aiDatabase';
import {
  buildAiKeyMigrationPlan,
  applyAiKeyMigration,
  type AiKeyMigrationOptions
} from './aiKeyMigration';
import {
  decrypt,
  encryptWithKey,
  getEncryptionKeyMaterial,
  type EncryptionKeyMaterial
} from '../../utils/encryption';
import type { DatabaseAdapter } from '../../db/database';

const makeConfig = (workspace: string, apiKeyEnc: string): AiConfigDbResult => ({
  workspace,
  provider: 'openrouter',
  api_key_enc: apiKeyEnc,
  base_url: null,
  model: null,
  temperature: null,
  system_prompt: null,
  enabled: true,
  created_at: new Date(),
  updated_at: new Date()
});

const makeLegacyCiphertext = (plaintext: string, material: EncryptionKeyMaterial) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', material.key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
};

const getKeys = (): AiKeyMigrationOptions => ({
  currentKey: getEncryptionKeyMaterial()!,
  oldKey: getEncryptionKeyMaterial('AI_ENCRYPTION_KEY_OLD', 'AI_ENCRYPTION_SALT_OLD')!,
  legacyFormat: 'plaintext'
});

beforeEach(() => {
  process.env['AI_ENCRYPTION_KEY'] = 'current-key';
  process.env['AI_ENCRYPTION_KEY_OLD'] = 'old-key';
});

afterEach(() => {
  delete process.env['AI_ENCRYPTION_KEY'];
  delete process.env['AI_ENCRYPTION_KEY_OLD'];
  delete process.env['AI_ENCRYPTION_SALT'];
  delete process.env['AI_ENCRYPTION_SALT_OLD'];
});

describe('buildAiKeyMigrationPlan', () => {
  it('migrates legacy plaintext and versioned values to v1', () => {
    const options = getKeys();
    const result = buildAiKeyMigrationPlan(
      [
        makeConfig('plain', 'legacy-key'),
        makeConfig('versioned', encryptWithKey('new-key', options.currentKey))
      ],
      options
    );

    expect(result.stats).toEqual({
      total: 2,
      legacyPlaintext: 1,
      legacyCiphertext: 0,
      versioned: 1
    });
    expect(result.plan.every(item => item.apiKeyEnc.startsWith('v1:'))).toBe(true);

    process.env['AI_ENCRYPTION_KEY'] = 'current-key';
    expect(decrypt(result.plan[0]!.apiKeyEnc)).toBe('legacy-key');
    expect(decrypt(result.plan[1]!.apiKeyEnc)).toBe('new-key');
  });

  it('requires explicit old-key decryption for legacy ciphertext mode', () => {
    const options = { ...getKeys(), legacyFormat: 'ciphertext' as const };
    const oldKey = options.oldKey!;
    const result = buildAiKeyMigrationPlan(
      [makeConfig('legacy-ciphertext', makeLegacyCiphertext('legacy-key', oldKey))],
      options
    );

    expect(result.stats.legacyCiphertext).toBe(1);
    expect(decrypt(result.plan[0]!.apiKeyEnc)).toBe('legacy-key');
  });

  it('fails before returning a plan when the old key is wrong', () => {
    const options = { ...getKeys(), legacyFormat: 'ciphertext' as const };
    const original = makeLegacyCiphertext('legacy-key', options.oldKey!);
    process.env['AI_ENCRYPTION_KEY_OLD'] = 'wrong-key';
    const wrongOptions = getKeys();

    expect(() =>
      buildAiKeyMigrationPlan([makeConfig('broken', original)], {
        ...wrongOptions,
        legacyFormat: 'ciphertext'
      })
    ).toThrowError('Workspace broken has an AI credential that cannot be decrypted');
  });
});

describe('applyAiKeyMigration', () => {
  it('updates every credential only after all values validate', async () => {
    const configs = [makeConfig('one', 'one-key'), makeConfig('two', 'two-key')];
    const updates: string[] = [];
    const db = {
      core: {
        transaction: async (callback: (tx: DatabaseAdapter) => Promise<unknown>) =>
          callback(db as never),
        close: async () => {},
        reset: async () => {},
        driver: 'sqlite' as const
      },
      ai: {
        listAiConfigs: async () => configs,
        upsertAiConfig: async (workspace: string, input: { api_key_enc?: string | null }) => {
          updates.push(workspace);
          configs.find(config => config.workspace === workspace)!.api_key_enc = input.api_key_enc!;
          return configs.find(config => config.workspace === workspace)!;
        }
      }
    } as unknown as DatabaseAdapter;

    const stats = await applyAiKeyMigration(db, getKeys());

    expect(stats.total).toBe(2);
    expect(updates).toEqual(['one', 'two']);
    expect(configs.every(config => config.api_key_enc?.startsWith('v1:'))).toBe(true);
  });

  it('does not update earlier records when a later record fails validation', async () => {
    const options = { ...getKeys(), legacyFormat: 'ciphertext' as const };
    const configs = [
      makeConfig('valid', makeLegacyCiphertext('valid-key', options.oldKey!)),
      makeConfig('broken', 'not-a-ciphertext')
    ];
    const updates: string[] = [];
    const db = {
      core: {
        transaction: async (callback: (tx: DatabaseAdapter) => Promise<unknown>) =>
          callback(db as never),
        close: async () => {},
        reset: async () => {},
        driver: 'sqlite' as const
      },
      ai: {
        listAiConfigs: async () => configs,
        upsertAiConfig: async (workspace: string, input: { api_key_enc?: string | null }) => {
          updates.push(workspace);
          configs.find(config => config.workspace === workspace)!.api_key_enc = input.api_key_enc!;
          return configs.find(config => config.workspace === workspace)!;
        }
      }
    } as unknown as DatabaseAdapter;

    await expect(applyAiKeyMigration(db, options)).rejects.toThrowError(
      'Workspace broken has an AI credential that cannot be decrypted'
    );
    expect(updates).toEqual([]);
  });
});

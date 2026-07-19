import type { DatabaseAdapter } from '../../db/database';
import type { AiConfigDbResult } from './db/aiDatabase';
import {
  AiEncryptionError,
  decryptLegacyCiphertextWithKey,
  decryptVersionedWithKey,
  encryptWithKey,
  type EncryptionKeyMaterial,
  VERSIONED_CIPHERTEXT_PREFIX
} from '../../utils/encryption';

export type LegacyAiKeyFormat = 'plaintext' | 'ciphertext';

export type AiKeyMigrationOptions = {
  currentKey: EncryptionKeyMaterial;
  oldKey?: EncryptionKeyMaterial;
  legacyFormat: LegacyAiKeyFormat;
};

export type AiKeyMigrationPlan = {
  workspace: string;
  apiKeyEnc: string;
  source: 'legacy-plaintext' | 'legacy-ciphertext' | 'versioned';
};

export type AiKeyMigrationStats = {
  total: number;
  legacyPlaintext: number;
  legacyCiphertext: number;
  versioned: number;
};

const isVersioned = (value: string) => value.startsWith(VERSIONED_CIPHERTEXT_PREFIX);

const migrationFailure = (workspace: string): never => {
  throw new Error(`Workspace ${workspace} has an AI credential that cannot be decrypted`);
};

const decryptVersionedWithAvailableKeys = (
  value: string,
  workspace: string,
  options: AiKeyMigrationOptions
) => {
  const candidates = [options.oldKey, options.currentKey].filter(
    (candidate, index, all): candidate is EncryptionKeyMaterial =>
      candidate !== undefined &&
      all.findIndex(other => other?.raw === candidate.raw && other.salt === candidate.salt) ===
        index
  );

  for (const key of candidates) {
    try {
      return decryptVersionedWithKey(value, key);
    } catch (error) {
      if (!(error instanceof AiEncryptionError)) throw error;
    }
  }

  return migrationFailure(workspace);
};

export const buildAiKeyMigrationPlan = (
  configs: AiConfigDbResult[],
  options: AiKeyMigrationOptions
): { plan: AiKeyMigrationPlan[]; stats: AiKeyMigrationStats } => {
  const plan: AiKeyMigrationPlan[] = [];
  const stats: AiKeyMigrationStats = {
    total: configs.length,
    legacyPlaintext: 0,
    legacyCiphertext: 0,
    versioned: 0
  };

  for (const config of configs) {
    const storedValue = config.api_key_enc;
    if (!storedValue) continue;

    let plaintext: string;
    let source: AiKeyMigrationPlan['source'];

    if (isVersioned(storedValue)) {
      plaintext = decryptVersionedWithAvailableKeys(storedValue, config.workspace, options);
      source = 'versioned';
      stats.versioned += 1;
    } else if (options.legacyFormat === 'plaintext') {
      plaintext = storedValue;
      source = 'legacy-plaintext';
      stats.legacyPlaintext += 1;
    } else {
      if (!options.oldKey) {
        throw new Error(
          'AI_ENCRYPTION_KEY_OLD is required when --legacy-format=ciphertext is selected'
        );
      }
      try {
        plaintext = decryptLegacyCiphertextWithKey(storedValue, options.oldKey);
      } catch (error) {
        if (error instanceof AiEncryptionError) return migrationFailure(config.workspace);
        throw error;
      }
      source = 'legacy-ciphertext';
      stats.legacyCiphertext += 1;
    }

    plan.push({
      workspace: config.workspace,
      apiKeyEnc: encryptWithKey(plaintext, options.currentKey),
      source
    });
  }

  return { plan, stats };
};

export const applyAiKeyMigration = async (
  db: DatabaseAdapter,
  options: AiKeyMigrationOptions
): Promise<AiKeyMigrationStats> =>
  db.core.transaction(async tx => {
    const configs = await tx.ai.listAiConfigs();
    const { plan, stats } = buildAiKeyMigrationPlan(configs, options);

    for (const item of plan) {
      await tx.ai.upsertAiConfig(item.workspace, { api_key_enc: item.apiKeyEnc });
    }

    return stats;
  });

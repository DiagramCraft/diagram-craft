import 'dotenv/config';
import { createDatabase } from '../db/factory';
import {
  applyAiKeyMigration,
  buildAiKeyMigrationPlan,
  type LegacyAiKeyFormat,
  type AiKeyMigrationOptions,
  type AiKeyMigrationStats
} from '../domain/ai/aiKeyMigration';
import { getEncryptionKeyMaterial } from '../utils/encryption';

export type RotateAiKeysArgs = {
  legacyFormat: LegacyAiKeyFormat;
  apply: boolean;
};

export const parseArgs = (argv: string[]): RotateAiKeysArgs => {
  let legacyFormat: LegacyAiKeyFormat | undefined;
  let apply = false;
  let check = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--legacy-format' || arg?.startsWith('--legacy-format=')) {
      const value =
        arg === '--legacy-format' ? argv[++index] : arg.slice('--legacy-format='.length);
      if (value !== 'plaintext' && value !== 'ciphertext') {
        throw new Error(`Invalid value for --legacy-format: ${value}`);
      }
      legacyFormat = value;
    } else if (arg === '--apply') {
      apply = true;
    } else if (arg === '--check') {
      check = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!legacyFormat) {
    throw new Error('--legacy-format=plaintext or --legacy-format=ciphertext is required');
  }
  if (apply && check) {
    throw new Error('--apply and --check cannot be used together');
  }

  return { legacyFormat, apply };
};

const printStats = (stats: AiKeyMigrationStats, apply: boolean) => {
  console.log(
    `${apply ? 'Migrated' : 'Validated'} ${stats.total} AI credential(s): ` +
      `${stats.versioned} versioned, ${stats.legacyPlaintext} legacy plaintext, ` +
      `${stats.legacyCiphertext} legacy ciphertext.`
  );
};

const buildOptions = (args: RotateAiKeysArgs): AiKeyMigrationOptions => {
  const currentKey = getEncryptionKeyMaterial('AI_ENCRYPTION_KEY', 'AI_ENCRYPTION_SALT');
  if (!currentKey) {
    throw new Error('AI_ENCRYPTION_KEY is required for AI credential migration');
  }

  return {
    currentKey,
    oldKey:
      getEncryptionKeyMaterial('AI_ENCRYPTION_KEY_OLD', 'AI_ENCRYPTION_SALT_OLD') ?? undefined,
    legacyFormat: args.legacyFormat
  };
};

export const run = async (argv: string[] = process.argv.slice(2)) => {
  const args = parseArgs(argv);
  const options = buildOptions(args);
  const db = await createDatabase({ initialize: false });

  try {
    if (args.apply) {
      printStats(await applyAiKeyMigration(db, options), true);
      return;
    }

    const configs = await db.ai.listAiConfigs();
    const { stats } = buildAiKeyMigrationPlan(configs, options);
    printStats(stats, false);
  } finally {
    await db.core.close();
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

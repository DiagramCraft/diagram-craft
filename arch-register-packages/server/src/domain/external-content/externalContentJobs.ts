import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { syncExternalContentSource } from './externalContentSync';

type ExternalContentJobContext = {
  workspace: string;
  payload: Record<string, unknown>;
  signal?: AbortSignal;
};

export const createExternalContentJobHandler =
  (
    db: DatabaseAdapter,
    storage: StorageAdapter
  ): ((context: ExternalContentJobContext) => Promise<Record<string, unknown> | null>) =>
  async context => {
    const sourceId = context.payload['sourceId'];
    if (typeof sourceId !== 'string' || sourceId.length === 0) {
      throw new Error('External content refresh job is missing sourceId');
    }
    return syncExternalContentSource(db, storage, context.workspace, sourceId, context.signal);
  };

import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';

/**
 * Guard for the direct create/update/delete routes of every schema-like definition. In `draft`
 * mode those changes must be staged through the schema draft API instead.
 */
export const assertDirectSchemaChangeMode = async (db: DatabaseAdapter, workspace: string) => {
  const mode = await db.schemaDraft.getSchemaChangeMode(workspace);
  httpAssert.true(mode === 'direct', {
    status: 409,
    message:
      'Schema changes must be staged in the schema draft while the workspace is in draft mode'
  });
};

/** Blocks bulk definition changes (e.g. definition import) while a draft is open. */
export const assertNoOpenSchemaDraft = async (db: DatabaseAdapter, workspace: string) => {
  const draft = await db.schemaDraft.getDraft(workspace);
  httpAssert.true(draft === null, {
    status: 409,
    message: 'A schema draft is open; publish or discard it before importing definitions'
  });
};

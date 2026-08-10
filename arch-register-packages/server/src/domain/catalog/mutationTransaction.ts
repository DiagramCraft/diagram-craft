import type { DatabaseAdapter } from '../../db/database';

/**
 * Runs a catalog mutation in one transaction, reusing the caller's transaction when it already
 * owns one. Mutation helpers deliberately do not open their own transaction so compound entity /
 * relation operations cannot commit only part of their work.
 */
export const withCatalogMutationTransaction = <T>(
  db: DatabaseAdapter,
  callback: (tx: DatabaseAdapter) => Promise<T>
): Promise<T> =>
  !db.core?.transaction || db.core.isTransaction ? callback(db) : db.core.transaction(callback);

/**
 * Guards the low-level mutation helpers against accidentally starting a composite write from the
 * root adapter. Partial unit-test doubles may omit `core`; production adapters always provide it.
 */
export const assertCatalogMutationTransaction = (db: DatabaseAdapter): void => {
  if (db.core?.isTransaction === false) {
    throw new Error('Catalog mutation helpers require a transaction-bound database adapter');
  }
};

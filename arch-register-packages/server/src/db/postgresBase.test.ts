import { describe, expect, it, vi } from 'vitest';
import {
  withPostgresTransaction,
  type PostgresSqlClient,
  type PostgresTransactionSql
} from './postgresBase';

describe('withPostgresTransaction', () => {
  it('starts a transaction for a root SQL client', async () => {
    const transaction = vi.fn() as unknown as PostgresTransactionSql;
    const begin = vi.fn(
      async (callback: (transaction: PostgresTransactionSql) => Promise<unknown>) =>
        callback(transaction)
    );
    const root = Object.assign(vi.fn(), { begin }) as unknown as PostgresSqlClient;

    const result = await withPostgresTransaction(root, async current => {
      expect(current).toBe(transaction);
      return ['committed'];
    });

    expect(begin).toHaveBeenCalledOnce();
    expect(result).toEqual(['committed']);
  });

  it('reuses an already-bound transaction without starting another one', async () => {
    const transaction = vi.fn() as unknown as PostgresTransactionSql;

    const result = await withPostgresTransaction(transaction, async current => {
      expect(current).toBe(transaction);
      return 'reused';
    });

    expect(result).toBe('reused');
  });
});

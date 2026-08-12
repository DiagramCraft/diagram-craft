import postgres from 'postgres';
import { DatabaseError } from './database';

export type PostgresSqlClient = ReturnType<typeof postgres>;
export type PostgresTransactionSql = postgres.TransactionSql;
export type PostgresQueryClient = PostgresSqlClient | PostgresTransactionSql;

export const withPostgresTransaction = async <T>(
  sql: PostgresQueryClient,
  callback: (transaction: PostgresQueryClient) => Promise<T>
): Promise<T> => {
  if ('begin' in sql) {
    const result = await sql.begin(async transaction => ({
      value: await callback(transaction)
    }));
    return result.value;
  }
  return callback(sql);
};

export const withPostgresSavepoint = async <T>(
  sql: PostgresQueryClient,
  callback: (savepoint: PostgresTransactionSql) => Promise<T>
): Promise<T> => {
  if (!('savepoint' in sql)) {
    throw new Error('PostgreSQL savepoints require a transaction-bound SQL client');
  }
  return (await sql.savepoint(callback)) as T;
};

// PostgreSQL error codes
const POSTGRES_ERROR_CODES = {
  UNIQUE: '23505',
  FOREIGN_KEY: '23503',
  CHECK: '23514',
  NOT_NULL: '23502',
  DEADLOCK: '40P01',
  SERIALIZATION_FAILURE: '40001',
  QUERY_CANCELED: '57014',
  DISK_FULL: '53100'
} as const;

export const normalizePostgresError = (error: unknown): never => {
  if (error != null && typeof error === 'object' && 'code' in error) {
    const pgError = error as {
      code: string;
      detail?: string;
      constraint?: string;
      message?: string;
    };
    const code = pgError.code;

    const details = {
      constraint: pgError.constraint,
      detail: pgError.detail,
      message: pgError.message
    };

    if (code === POSTGRES_ERROR_CODES.UNIQUE)
      throw new DatabaseError('unique', 'Unique constraint violation', error, details);
    if (code === POSTGRES_ERROR_CODES.FOREIGN_KEY)
      throw new DatabaseError('foreign', 'Foreign key constraint violation', error, details);
    if (code === POSTGRES_ERROR_CODES.CHECK)
      throw new DatabaseError('check', 'Check constraint violation', error, details);
    if (code === POSTGRES_ERROR_CODES.NOT_NULL)
      throw new DatabaseError('notnull', 'Not null constraint violation', error, details);
    if (code === POSTGRES_ERROR_CODES.DEADLOCK)
      throw new DatabaseError('deadlock', 'Deadlock detected', error, details);
    if (code === POSTGRES_ERROR_CODES.SERIALIZATION_FAILURE)
      throw new DatabaseError('serialization', 'Serialization failure', error, details);
    if (code === POSTGRES_ERROR_CODES.QUERY_CANCELED)
      throw new DatabaseError('timeout', 'Query timeout', error, details);
    if (code.startsWith('08'))
      throw new DatabaseError('connection', 'Connection error', error, details);
    if (code === POSTGRES_ERROR_CODES.DISK_FULL)
      throw new DatabaseError('disk_full', 'Disk full', error, details);
  }
  throw new DatabaseError('unknown', 'Database operation failed', error);
};

export class PostgresDatabaseBase {
  constructor(protected readonly sql: PostgresQueryClient) {}

  protected json(value: unknown) {
    return this.sql.json(value as Parameters<PostgresSqlClient['json']>[0]);
  }
}

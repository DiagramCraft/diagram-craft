import postgres from 'postgres';
import { DatabaseError } from './database';

export type PostgresSqlClient = ReturnType<typeof postgres>;

export const normalizePostgresError = (error: unknown): never => {
  if (error != null && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === '23505')
      throw new DatabaseError('unique', 'Unique constraint violation', error);
    if (code === '23503')
      throw new DatabaseError('foreign', 'Foreign key constraint violation', error);
    if (code === '23514')
      throw new DatabaseError('check', 'Check constraint violation', error);
    if (code === '23502')
      throw new DatabaseError('notnull', 'Not null constraint violation', error);
  }
  throw new DatabaseError('unknown', 'Database operation failed', error);
};

export class PostgresDatabaseBase {
  constructor(protected readonly sql: PostgresSqlClient) {}

  protected json(value: unknown) {
    return this.sql.json(value as Parameters<PostgresSqlClient['json']>[0]);
  }
}

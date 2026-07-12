import type { Database as DatabaseType } from 'better-sqlite3';
import { DatabaseError } from './database';

// SQLite error codes (numeric)
const SQLITE_ERROR_CODES = {
  CONSTRAINT: 19,
  BUSY: 5,
  LOCKED: 6,
  FULL: 13,
  IOERR: 10,
  CANTOPEN: 14,
} as const;

export const normalizeSqliteError = (error: unknown): never => {
  if (error != null && typeof error === 'object') {
    const sqliteError = error as { code: string | number; message?: string };
    
    // Try numeric error code first (better-sqlite3 uses numeric codes)
    if (typeof sqliteError.code === 'number') {
      const code = sqliteError.code;
      const message = sqliteError.message?.toLowerCase() ?? '';
      
      if (code === SQLITE_ERROR_CODES.CONSTRAINT) {
        // Parse constraint type from message
        if (message.includes('unique') || message.includes('primary key'))
          throw new DatabaseError('unique', 'Unique constraint violation', error);
        if (message.includes('foreign key'))
          throw new DatabaseError('foreign', 'Foreign key constraint violation', error);
        if (message.includes('check'))
          throw new DatabaseError('check', 'Check constraint violation', error);
        if (message.includes('not null'))
          throw new DatabaseError('notnull', 'Not null constraint violation', error);
      }
      
      if (code === SQLITE_ERROR_CODES.BUSY || code === SQLITE_ERROR_CODES.LOCKED)
        throw new DatabaseError('deadlock', 'Database locked', error);
      if (code === SQLITE_ERROR_CODES.FULL)
        throw new DatabaseError('disk_full', 'Disk full', error);
      if (code === SQLITE_ERROR_CODES.IOERR || code === SQLITE_ERROR_CODES.CANTOPEN)
        throw new DatabaseError('connection', 'I/O error', error);
    }
    
    // Fallback to string code matching for compatibility
    if (typeof sqliteError.code === 'string') {
      const code = sqliteError.code.toLowerCase();
      if (code.includes('unique') || code.includes('primary'))
        throw new DatabaseError('unique', 'Unique constraint violation', error);
      if (code.includes('foreign'))
        throw new DatabaseError('foreign', 'Foreign key constraint violation', error);
      if (code.includes('check'))
        throw new DatabaseError('check', 'Check constraint violation', error);
      if (code.includes('not null'))
        throw new DatabaseError('notnull', 'Not null constraint violation', error);
    }
  }
  throw new DatabaseError('unknown', 'Database operation failed', error);
};

export class SqliteDatabaseBase {
  constructor(private readonly getDb: () => DatabaseType) {}

  protected get db() {
    return this.getDb();
  }

  protected all<T>(
    sql: string,
    params: unknown[] = [],
    map?: (row: Record<string, unknown>) => T
  ): T[] {
    try {
      const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
      return map ? rows.map(map) : (rows as T[]);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  protected get<T>(
    sql: string,
    params: unknown[] = [],
    map?: (row: Record<string, unknown>) => T
  ): T | null {
    try {
      const row = this.db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
      if (!row) return null;
      return map ? map(row) : (row as T);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  protected run(sql: string, params: unknown[] = []) {
    try {
      return this.db.prepare(sql).run(...params);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }
}

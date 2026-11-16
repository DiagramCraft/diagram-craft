/**
 * A minimal, synchronous subset of the `better-sqlite3` API implemented over the official
 * in-memory `@sqlite.org/sqlite-wasm` build. It is intended to be swapped in through a bundler/test
 * alias (`better-sqlite3` -> this file) for the browser demo; it is never used by the regular server.
 *
 * Only the surface the server uses is provided: `prepare().all/get/run`, `exec`, `pragma`,
 * `transaction` and `close`. The database is always in-memory; the file path is ignored.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const sqlite3 = await sqlite3InitModule();

// sqlite-wasm logs every failed step (e.g. expected constraint violations) through config.warn;
// errors are thrown to the caller anyway, so the logging is just noise
sqlite3.config.warn = () => {};

type BindValue = number | bigint | string | Uint8Array | null;

const toBindValue = (value: unknown): BindValue => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') {
    return value;
  }
  throw new TypeError(`SQLite can only bind numbers, strings, bigints, booleans, buffers and null`);
};

const toBindArray = (params: unknown[]): BindValue[] => {
  const flat = params.length === 1 && Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
  return flat.map(toBindValue);
};

/** Re-throws wasm errors with a primary numeric `code`, as better-sqlite3 consumers expect. */
const wrapError = (error: unknown): never => {
  if (error instanceof Error) {
    const resultCode = (error as { resultCode?: unknown }).resultCode;
    if (typeof resultCode === 'number') {
      // Extended result codes (e.g. 2067 UNIQUE) reduce to the primary code in the low byte
      Object.defineProperty(error, 'code', {
        value: resultCode & 0xff,
        configurable: true,
        writable: true
      });
    }
  }
  throw error;
};

type RunResult = { changes: number; lastInsertRowid: number | bigint };

class Statement {
  constructor(
    private readonly db: Database,
    private readonly sql: string
  ) {}

  private withStatement<T>(params: unknown[], fn: (stmt: StatementHandle) => T): T {
    try {
      const stmt = this.db.raw.prepare(this.sql);
      try {
        const bind = toBindArray(params);
        if (bind.length > 0) stmt.bind(bind);
        return fn(stmt);
      } finally {
        stmt.finalize();
      }
    } catch (error) {
      return wrapError(error);
    }
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    return this.withStatement(params, stmt => {
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.get({}) as Record<string, unknown>);
      return rows;
    });
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    return this.withStatement(params, stmt =>
      stmt.step() ? (stmt.get({}) as Record<string, unknown>) : undefined
    );
  }

  run(...params: unknown[]): RunResult {
    return this.withStatement(params, stmt => {
      while (stmt.step()) {
        // drain (e.g. INSERT ... RETURNING)
      }
      return {
        changes: this.db.raw.changes(),
        lastInsertRowid: sqlite3.capi.sqlite3_last_insert_rowid(this.db.raw)
      };
    });
  }
}

type RawDb = InstanceType<typeof sqlite3.oo1.DB>;
type StatementHandle = ReturnType<RawDb['prepare']>;

export class Database {
  readonly raw: RawDb;
  private savepointCounter = 0;

  // The path is intentionally ignored: the shim is in-memory only
  constructor(_filePath?: string) {
    this.raw = new sqlite3.oo1.DB(':memory:', 'c');
  }

  prepare(sql: string): Statement {
    return new Statement(this, sql);
  }

  exec(sql: string): this {
    try {
      this.raw.exec(sql);
    } catch (error) {
      wrapError(error);
    }
    return this;
  }

  /** WAL and friends are meaningless in memory; other pragmas are executed. */
  pragma(source: string): unknown {
    if (/^\s*journal_mode\s*=/i.test(source)) return [{ journal_mode: 'memory' }];
    const rows = this.prepare(`PRAGMA ${source}`).all();
    return rows;
  }

  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
      // Ask SQLite, since callers may also have opened a transaction through raw exec('BEGIN')
      const outer = sqlite3.capi.sqlite3_get_autocommit(this.raw) !== 0;
      const name = `shim_sp_${this.savepointCounter++}`;
      this.exec(outer ? 'BEGIN' : `SAVEPOINT ${name}`);
      try {
        const result = fn(...args);
        this.exec(outer ? 'COMMIT' : `RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (error) {
        try {
          if (outer) this.exec('ROLLBACK');
          else this.exec(`ROLLBACK TO SAVEPOINT ${name}; RELEASE SAVEPOINT ${name}`);
        } catch {
          // keep the original error
        }
        throw error;
      }
    };
  }

  close(): void {
    this.raw.close();
  }
}

export default Database;

declare module 'better-sqlite3' {
  type RunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  interface Statement<TRow = unknown> {
    all(...params: unknown[]): TRow[];
    get(...params: unknown[]): TRow | undefined;
    run(...params: unknown[]): RunResult;
  }

  type Transaction<TArgs extends unknown[] = [], TResult = unknown> = ((
    ...params: TArgs
  ) => TResult) & {
    default: (...params: TArgs) => TResult;
    deferred: (...params: TArgs) => TResult;
    immediate: (...params: TArgs) => TResult;
    exclusive: (...params: TArgs) => TResult;
  };

  class Database {
    constructor(filename: string, options?: unknown);
    pragma(source: string): unknown;
    close(): void;
    exec(source: string): this;
    prepare<TRow = unknown>(source: string): Statement<TRow>;
    transaction<TArgs extends unknown[], TResult>(
      fn: (...params: TArgs) => TResult
    ): Transaction<TArgs, TResult>;
  }

  export default Database;
  export { Database };
}

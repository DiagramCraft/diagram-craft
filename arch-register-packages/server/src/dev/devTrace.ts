import type { Database as SqliteDatabaseType } from 'better-sqlite3';
import { createLogger } from '../utils/logger';
import { getTraceContext, runWithTraceContext, type TraceContext } from './traceContext';

const logger = createLogger('trace');

const MAX_TRACES = 50;

export type SqlSpan = {
  id: string;
  startedAt: number;
  durationMs: number;
  sql: string;
  params: unknown[];
  rowCount: number | null;
  error: string | undefined;
};

export type RequestSpan = {
  spanId: string;
  traceId: string;
  method: string;
  path: string;
  interaction: string | undefined;
  startedAt: number;
  durationMs: number | null;
  status: number | null;
  error: string | undefined;
  sql: SqlSpan[];
};

export type TraceRecord = {
  traceId: string;
  interaction: string | undefined;
  startedAt: number;
  requests: RequestSpan[];
};

/** Insertion-ordered ring buffer of recent traces, keyed by trace id. */
const traces = new Map<string, TraceRecord>();

const nextId = () => Math.random().toString(36).slice(2, 10);

const trimBuffer = () => {
  while (traces.size > MAX_TRACES) {
    const oldest = traces.keys().next().value;
    if (oldest === undefined) break;
    traces.delete(oldest);
  }
};

const getOrCreateRecord = (traceId: string, interaction: string | undefined): TraceRecord => {
  let record = traces.get(traceId);
  if (!record) {
    record = { traceId, interaction, startedAt: Date.now(), requests: [] };
    traces.set(traceId, record);
    trimBuffer();
  } else if (interaction && !record.interaction) {
    record.interaction = interaction;
  }
  return record;
};

export const getTrace = (traceId: string): TraceRecord | null => traces.get(traceId) ?? null;

export const clearTraces = () => traces.clear();

type StartRequestSpanInput = {
  traceId: string;
  spanId: string;
  interaction: string | undefined;
  method: string;
  path: string;
};

export const startRequestSpan = (input: StartRequestSpanInput): RequestSpan => {
  const record = getOrCreateRecord(input.traceId, input.interaction);
  const span: RequestSpan = {
    spanId: input.spanId,
    traceId: input.traceId,
    method: input.method,
    path: input.path,
    interaction: input.interaction,
    startedAt: performance.now(),
    durationMs: null,
    status: null,
    error: undefined,
    sql: []
  };
  record.requests.push(span);
  return span;
};

/** Drop a provisional request span (e.g. the oRPC router did not match). */
export const discardRequestSpan = (span: RequestSpan) => {
  const record = traces.get(span.traceId);
  if (!record) return;
  record.requests = record.requests.filter(r => r !== span);
  if (record.requests.length === 0) traces.delete(span.traceId);
};

export const finishRequestSpan = (
  span: RequestSpan,
  result: { status?: number | null; error?: string }
) => {
  span.durationMs = Math.round((performance.now() - span.startedAt) * 100) / 100;
  span.status = result.status ?? span.status;
  span.error = result.error ?? span.error;
  logger.debug(
    `${span.method} ${span.path} ${span.status ?? '-'} ${span.durationMs}ms` +
      ` (${span.sql.length} sql)` +
      (span.interaction ? ` <- ${span.interaction}` : '')
  );
};

/**
 * Run `fn` with an active trace context so DB spans recorded underneath are
 * attributed to `span`.
 */
export const withRequestSpan = <T>(span: RequestSpan, fn: () => T): T =>
  runWithTraceContext(
    { traceId: span.traceId, spanId: span.spanId, interaction: span.interaction },
    fn
  );

type RecordSqlInput = {
  sql: string;
  params?: unknown[];
  durationMs: number;
  rowCount?: number | null;
  error?: string;
};

export const recordSqlSpan = (input: RecordSqlInput, context?: TraceContext) => {
  const ctx = context ?? getTraceContext();
  if (!ctx) return;

  const record = traces.get(ctx.traceId);
  const requestSpan = record?.requests.find(r => r.spanId === ctx.spanId);
  if (!requestSpan) return;

  const span: SqlSpan = {
    id: nextId(),
    startedAt: performance.now(),
    durationMs: Math.round(input.durationMs * 100) / 100,
    sql: input.sql.trim(),
    params: input.params ?? [],
    rowCount: input.rowCount ?? null,
    error: input.error
  };
  requestSpan.sql.push(span);
  logger.debug(
    `  SQL ${span.durationMs}ms rows=${span.rowCount ?? '-'} ${span.sql.replace(/\s+/g, ' ').slice(0, 200)}`
  );
};

const timed = <T>(fn: () => T): { result: T; durationMs: number } => {
  const start = performance.now();
  const result = fn();
  return { result, durationMs: performance.now() - start };
};

const normalizeParams = (params: unknown[]): unknown[] => {
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object') {
    return [params[0]];
  }
  return params;
};

const rowCountOf = (value: unknown): number | null => {
  if (Array.isArray(value)) return value.length;
  if (value === undefined || value === null) return 0;
  if (typeof value === 'object' && 'changes' in (value as Record<string, unknown>)) {
    return Number((value as { changes: unknown }).changes) || 0;
  }
  return 1;
};

/**
 * Wraps a better-sqlite3 Database so every prepared-statement execution records
 * a SQL span. Covers both `SqliteDatabaseBase` and repositories that call
 * `db.prepare(...)` directly.
 */
export const instrumentSqliteDatabase = (db: SqliteDatabaseType): SqliteDatabaseType =>
  new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'prepare') {
        return (source: string, ...rest: unknown[]) => {
          const statement = (target.prepare as (s: string, ...r: unknown[]) => unknown)(
            source,
            ...rest
          );
          return new Proxy(statement as object, {
            get(stmtTarget, stmtProp, stmtReceiver) {
              if (stmtProp === 'run' || stmtProp === 'get' || stmtProp === 'all') {
                return (...params: unknown[]) => {
                  const ctx = getTraceContext();
                  const invoke = () =>
                    (
                      Reflect.get(stmtTarget, stmtProp, stmtReceiver) as (
                        ...a: unknown[]
                      ) => unknown
                    ).apply(stmtTarget, params);
                  if (!ctx) return invoke();
                  try {
                    const { result, durationMs } = timed(invoke);
                    recordSqlSpan(
                      {
                        sql: source,
                        params: normalizeParams(params),
                        durationMs,
                        rowCount: rowCountOf(result)
                      },
                      ctx
                    );
                    return result;
                  } catch (error) {
                    recordSqlSpan(
                      {
                        sql: source,
                        params: normalizeParams(params),
                        durationMs: 0,
                        error: error instanceof Error ? error.message : String(error)
                      },
                      ctx
                    );
                    throw error;
                  }
                };
              }
              return Reflect.get(stmtTarget, stmtProp, stmtReceiver);
            }
          });
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });

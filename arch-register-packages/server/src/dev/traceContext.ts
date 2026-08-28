import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Active dev-tracing context for the current request.
 *
 * This module is intentionally dependency-free (in particular it does not import
 * the logger) so that `logger.ts` can read the active context without creating
 * an import cycle.
 */
export type TraceContext = {
  traceId: string;
  spanId: string;
  interaction: string | undefined;
};

const storage = new AsyncLocalStorage<TraceContext>();

export const runWithTraceContext = <T>(context: TraceContext, fn: () => T): T =>
  storage.run(context, fn);

export const getTraceContext = (): TraceContext | undefined => storage.getStore();

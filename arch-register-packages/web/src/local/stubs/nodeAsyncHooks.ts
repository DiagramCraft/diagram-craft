/**
 * Minimal stand-in for node:async_hooks. The server only uses `AsyncLocalStorage` for dev
 * tracing (`dev/traceContext.ts`); here the store is visible for the synchronous part of `run`,
 * which is enough because tracing is not used in the demo.
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, fn: () => R): R {
    const previous = this.store;
    this.store = store;
    try {
      return fn();
    } finally {
      this.store = previous;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }
}

export default { AsyncLocalStorage };

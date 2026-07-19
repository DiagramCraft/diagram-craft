import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { createOidcCallbackRoute } from './oidcCallbackRoute';

const makeDb = (cleanupExpiredOidcAuthStates: () => Promise<void>): DatabaseAdapter =>
  ({
    auth: { cleanupExpiredOidcAuthStates }
  }) as unknown as DatabaseAdapter;

describe('createOidcCallbackRoute cleanup lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('binds cleanup timers to their route instance database adapters', async () => {
    const firstCleanup = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const secondCleanup = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const firstRoute = createOidcCallbackRoute(makeDb(firstCleanup));
    const secondRoute = createOidcCallbackRoute(makeDb(secondCleanup));

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(firstCleanup).toHaveBeenCalledOnce();
    expect(secondCleanup).toHaveBeenCalledOnce();

    firstRoute.dispose();
    secondRoute.dispose();
  });

  it('stops cleanup when disposed and allows repeated disposal', async () => {
    const cleanup = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const route = createOidcCallbackRoute(makeDb(cleanup));

    route.dispose();
    route.dispose();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(cleanup).not.toHaveBeenCalled();
  });
});

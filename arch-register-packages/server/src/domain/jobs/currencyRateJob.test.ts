import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { createCurrencyRatesJobHandler } from './currencyRateJob';

const makeDb = (overrides: Record<string, unknown> = {}) =>
  ({
    currencyRates: {
      getSnapshotForFetchDay: vi.fn(async () => null),
      tryAcquireRefreshLease: vi.fn(async () => true),
      releaseRefreshLease: vi.fn(async () => undefined),
      upsertSnapshot: vi.fn(async input => ({ ...input }))
    },
    ...overrides
  }) as unknown as DatabaseAdapter;

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

describe('currency rate job', () => {
  it('fetches and stores one normalized USD snapshot per day', async () => {
    const db = makeDb();
    const fetchImpl = vi.fn(async () =>
      response({ date: '2026-08-07', usd: { usd: 1, eur: 0.9, sek: 10 } })
    );
    const result = await createCurrencyRatesJobHandler(
      db,
      fetchImpl,
      () => new Date('2026-08-07T02:00:00.000Z')
    )({ signal: new AbortController().signal });

    expect(result).toMatchObject({ fetched: true, fetchDay: '2026-08-07', rateDate: '2026-08-07' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(db.currencyRates.upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch_day: '2026-08-07',
        base_currency: 'USD',
        rates: { USD: 1, EUR: 0.9, SEK: 10 }
      })
    );
  });

  it('ignores provider entries that are not three-letter currency codes', async () => {
    const db = makeDb();
    const fetchImpl = vi.fn(async () =>
      response({ date: '2026-08-07', usd: { usd: 1, eur: 0.9, '1inch': 0.5 } })
    );

    await createCurrencyRatesJobHandler(
      db,
      fetchImpl,
      () => new Date('2026-08-07T02:00:00.000Z')
    )({ signal: new AbortController().signal });

    expect(db.currencyRates.upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ rates: { USD: 1, EUR: 0.9 } })
    );
  });

  it('uses the fallback provider URL when the primary fails', async () => {
    const db = makeDb();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response({ date: '2026-08-07', usd: { usd: 1, eur: 0.9 } }));

    await createCurrencyRatesJobHandler(
      db,
      fetchImpl,
      () => new Date('2026-08-07T02:00:00.000Z')
    )({ signal: new AbortController().signal });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toContain('currency-api.pages.dev');
  });

  it('does not fetch when the UTC day already has a snapshot', async () => {
    const db = makeDb({
      currencyRates: {
        getSnapshotForFetchDay: vi.fn(async () => ({ fetch_day: '2026-08-07' })),
        tryAcquireRefreshLease: vi.fn(),
        releaseRefreshLease: vi.fn(),
        upsertSnapshot: vi.fn()
      }
    });
    const fetchImpl = vi.fn();
    const result = await createCurrencyRatesJobHandler(
      db,
      fetchImpl,
      () => new Date('2026-08-07T12:00:00.000Z')
    )({ signal: new AbortController().signal });

    expect(result).toEqual({ fetched: false, fetchDay: '2026-08-07' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

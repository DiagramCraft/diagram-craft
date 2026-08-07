import type { DatabaseAdapter } from '../../db/database';
import { createJobSchedule } from './jobOperations';
import { RetryableJobError } from './jobRetry';

export const CURRENCY_RATES_JOB_TYPE = 'currency-rates';
export const CURRENCY_RATES_SYSTEM_IDENTITY = 'currency-rates';
export const CURRENCY_RATES_FETCH_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
export const CURRENCY_RATES_FALLBACK_URL =
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json';

type ProviderPayload = {
  date: string;
  usd: Record<string, unknown>;
};

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

const isProviderPayload = (value: unknown): value is ProviderPayload => {
  if (typeof value !== 'object' || value == null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['date'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate['date']) &&
    typeof candidate['usd'] === 'object' &&
    candidate['usd'] != null &&
    !Array.isArray(candidate['usd'])
  );
};

const normalizeRates = (payload: ProviderPayload) => {
  const rates: Record<string, number> = { USD: 1 };
  for (const [code, rawRate] of Object.entries(payload.usd)) {
    // The provider also publishes crypto and token symbols such as `1inch`.
    // Workspace currency values use three-letter ISO-style codes, so those
    // provider entries are intentionally not persisted in the FX snapshot.
    if (!/^[a-z]{3}$/i.test(code)) continue;
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Currency provider returned an invalid USD rate for '${code}'`);
    }
    rates[code.toUpperCase()] = rate;
  }
  return rates;
};

const fetchProviderPayload = async (signal: AbortSignal, fetchImpl = fetch) => {
  let retryableFailure: Error | null = null;
  for (const url of [CURRENCY_RATES_FETCH_URL, CURRENCY_RATES_FALLBACK_URL]) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        signal,
        headers: { accept: 'application/json', 'user-agent': 'Arch-Register/Currency-Rates' }
      });
    } catch (error) {
      retryableFailure = error instanceof Error ? error : new Error(String(error));
      continue;
    }

    if (response.ok) {
      const body = (await response.json()) as unknown;
      if (!isProviderPayload(body)) {
        throw new Error('Currency provider returned an invalid response');
      }
      return body;
    }

    if (response.status === 429 || response.status >= 500) {
      retryableFailure = new Error(`Currency provider returned HTTP ${response.status}`);
      continue;
    }
    retryableFailure = new Error(`Currency provider returned HTTP ${response.status}`);
  }

  throw new RetryableJobError(retryableFailure?.message ?? 'Currency provider request failed');
};

export const ensureCurrencyRatesSchedule = async (
  db: DatabaseAdapter,
  workspace: string,
  now = new Date()
) => {
  const schedules = await db.jobs.listSchedules(workspace);
  const existing = schedules.find(
    schedule =>
      schedule.job_type === CURRENCY_RATES_JOB_TYPE &&
      schedule.system_identity === CURRENCY_RATES_SYSTEM_IDENTITY
  );
  if (existing) return existing;
  return createJobSchedule(
    db,
    {
      workspace,
      jobType: CURRENCY_RATES_JOB_TYPE,
      systemIdentity: CURRENCY_RATES_SYSTEM_IDENTITY,
      payload: {},
      priority: 5,
      recurrence: { type: 'daily', timeUtc: '02:00' }
    },
    now
  );
};

export const ensureAllCurrencyRatesSchedules = async (db: DatabaseAdapter, now = new Date()) => {
  const workspaces = await db.workspace.listWorkspaces();
  for (const workspace of workspaces) {
    await ensureCurrencyRatesSchedule(db, workspace.id, now);
  }
};

export const createCurrencyRatesJobHandler =
  (db: DatabaseAdapter, fetchImpl = fetch, clock: () => Date = () => new Date()) =>
  async (context: { signal: AbortSignal }) => {
    const now = clock();
    const fetchDay = utcDay(now);
    if (await db.currencyRates.getSnapshotForFetchDay(fetchDay)) {
      return { fetched: false, fetchDay };
    }

    const locked = await db.currencyRates.tryAcquireRefreshLease(
      now,
      new Date(now.getTime() + 10 * 60 * 1000)
    );
    if (!locked) return { fetched: false, fetchDay, locked: true };

    try {
      if (await db.currencyRates.getSnapshotForFetchDay(fetchDay)) {
        return { fetched: false, fetchDay };
      }
      const payload = await fetchProviderPayload(context.signal, fetchImpl);
      const snapshot = await db.currencyRates.upsertSnapshot({
        fetch_day: fetchDay,
        rate_date: payload.date,
        base_currency: 'USD',
        rates: normalizeRates(payload),
        fetched_at: now
      });
      return { fetched: true, fetchDay, rateDate: snapshot.rate_date };
    } finally {
      await db.currencyRates.releaseRefreshLease();
    }
  };

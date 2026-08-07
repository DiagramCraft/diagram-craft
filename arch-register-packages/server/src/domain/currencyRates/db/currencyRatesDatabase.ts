import {
  databaseDate,
  databaseDateOnly,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

export type CurrencyRateSnapshotDbResult = {
  fetch_day: string;
  rate_date: string;
  base_currency: string;
  rates: Record<string, number>;
  fetched_at: Date;
};

export type CurrencyRateSnapshotDbCreate = CurrencyRateSnapshotDbResult;

export const currencyRateMappers = {
  snapshot: (row: DatabaseRow): CurrencyRateSnapshotDbResult => ({
    fetch_day: databaseDateOnly(row['fetch_day']),
    rate_date: databaseDateOnly(row['rate_date']),
    base_currency: String(row['base_currency']),
    rates: parseDatabaseJson(row['rates'], {}, 'currency_rate_snapshot.rates'),
    fetched_at: databaseDate(row['fetched_at'])
  })
};

export type CurrencyRatesDatabase = {
  getLatestSnapshot(): Promise<CurrencyRateSnapshotDbResult | null>;
  getSnapshotForFetchDay(fetchDay: string): Promise<CurrencyRateSnapshotDbResult | null>;
  tryAcquireRefreshLease(now: Date, lockedUntil: Date): Promise<boolean>;
  releaseRefreshLease(): Promise<void>;
  upsertSnapshot(input: CurrencyRateSnapshotDbCreate): Promise<CurrencyRateSnapshotDbResult>;
};

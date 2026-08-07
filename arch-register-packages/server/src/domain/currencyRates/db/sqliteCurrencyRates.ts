import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type { CurrencyRateSnapshotDbCreate, CurrencyRatesDatabase } from './currencyRatesDatabase';
import { currencyRateMappers } from './currencyRatesDatabase';

const iso = (date: Date) => date.toISOString();

export class SqliteCurrencyRatesDatabase
  extends SqliteDatabaseBase
  implements CurrencyRatesDatabase
{
  async getLatestSnapshot() {
    return this.get(
      'SELECT * FROM currency_rate_snapshot ORDER BY fetched_at DESC LIMIT 1',
      [],
      currencyRateMappers.snapshot
    );
  }

  async getSnapshotForFetchDay(fetchDay: string) {
    return this.get(
      'SELECT * FROM currency_rate_snapshot WHERE fetch_day = ?',
      [fetchDay],
      currencyRateMappers.snapshot
    );
  }

  async tryAcquireRefreshLease(now: Date, lockedUntil: Date) {
    const result = this.run(
      `UPDATE currency_rate_refresh_lock
       SET locked_until = ?
       WHERE id = 'global' AND locked_until <= ?`,
      [iso(lockedUntil), iso(now)]
    );
    return result.changes > 0;
  }

  async releaseRefreshLease() {
    this.run(
      `UPDATE currency_rate_refresh_lock
       SET locked_until = '1970-01-01T00:00:00.000Z'
       WHERE id = 'global'`
    );
  }

  async upsertSnapshot(input: CurrencyRateSnapshotDbCreate) {
    this.run(
      `INSERT INTO currency_rate_snapshot
         (fetch_day, rate_date, base_currency, rates, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(fetch_day) DO UPDATE SET
         rate_date = excluded.rate_date,
         base_currency = excluded.base_currency,
         rates = excluded.rates,
         fetched_at = excluded.fetched_at`,
      [
        input.fetch_day,
        input.rate_date,
        input.base_currency,
        JSON.stringify(input.rates),
        iso(input.fetched_at)
      ]
    );
    const snapshot = await this.getSnapshotForFetchDay(input.fetch_day);
    if (!snapshot) throw new Error('Currency rate snapshot was not persisted');
    return snapshot;
  }
}

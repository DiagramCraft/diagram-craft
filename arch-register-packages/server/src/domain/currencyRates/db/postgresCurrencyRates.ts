import { mapDatabaseRow, type DatabaseRow } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type { CurrencyRateSnapshotDbCreate, CurrencyRatesDatabase } from './currencyRatesDatabase';
import { currencyRateMappers } from './currencyRatesDatabase';

export class PostgresCurrencyRatesDatabase
  extends PostgresDatabaseBase
  implements CurrencyRatesDatabase
{
  async getLatestSnapshot() {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM currency_rate_snapshot ORDER BY fetched_at DESC LIMIT 1
    `;
    return mapDatabaseRow(rows[0], currencyRateMappers.snapshot);
  }

  async getSnapshotForFetchDay(fetchDay: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM currency_rate_snapshot WHERE fetch_day = ${fetchDay}
    `;
    return mapDatabaseRow(rows[0], currencyRateMappers.snapshot);
  }

  async tryAcquireRefreshLease(now: Date, lockedUntil: Date) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE currency_rate_refresh_lock
        SET locked_until = ${lockedUntil}
        WHERE id = 'global' AND locked_until <= ${now}
        RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async releaseRefreshLease() {
    await this.sql`
      UPDATE currency_rate_refresh_lock
      SET locked_until = TIMESTAMPTZ '1970-01-01 00:00:00+00'
      WHERE id = 'global'
    `;
  }

  async upsertSnapshot(input: CurrencyRateSnapshotDbCreate) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        INSERT INTO currency_rate_snapshot
          (fetch_day, rate_date, base_currency, rates, fetched_at)
        VALUES (${input.fetch_day}, ${input.rate_date}, ${input.base_currency}, ${this.json(input.rates)}, ${input.fetched_at})
        ON CONFLICT (fetch_day) DO UPDATE SET
          rate_date = EXCLUDED.rate_date,
          base_currency = EXCLUDED.base_currency,
          rates = EXCLUDED.rates,
          fetched_at = EXCLUDED.fetched_at
        RETURNING *
      `;
      return currencyRateMappers.snapshot(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}

import { afterAll, beforeAll, describe, it } from 'vitest';
import type { DatabaseAdapter, DbDriver } from '../database';
import {
  provisionPostgresDatabase,
  provisionSqliteDatabase,
  type ProvisionedDatabase
} from '../testSupport/provisionDatabase';

type ContractSuite = (getDb: () => DatabaseAdapter, driver: DbDriver) => void;

const runDriverSuite = (
  driver: DbDriver,
  provision: () => Promise<ProvisionedDatabase>,
  suite: ContractSuite
) => {
  describe(driver, () => {
    let provisioned: ProvisionedDatabase;

    beforeAll(async () => {
      provisioned = await provision();
    });

    afterAll(async () => {
      await provisioned.teardown();
    });

    suite(() => provisioned.db, driver);
  });
};

export const runContractSuiteAgainstBothDrivers = (suiteName: string, suite: ContractSuite) => {
  describe(suiteName, () => {
    runDriverSuite('sqlite', provisionSqliteDatabase, suite);

    if (process.env['DATABASE_URL']) {
      runDriverSuite('postgres', provisionPostgresDatabase, suite);
    } else {
      it.skip('postgres suite skipped: DATABASE_URL not set', () => {});
    }
  });
};

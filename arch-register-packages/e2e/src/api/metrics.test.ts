import { seededEntities, seededSchemas, seededUsers } from '@arch-register/server/db/seedFixtures';
import { createApiTest, expect } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';

const test = createApiTest({
  seed: 'bootstrap',
  afterSeed: async server => {
    await server.db.currencyRates.upsertSnapshot({
      fetch_day: '2026-08-07',
      rate_date: '2026-08-07',
      base_currency: 'USD',
      rates: { USD: 1, EUR: 2, GBP: 0.8, SEK: 10, NOK: 11, DKK: 7 },
      fetched_at: new Date('2026-08-07T02:00:00.000Z')
    });
  }
}).extend<{ auth: string }>({
  auth: [
    async ({ server }, use) => {
      await use(await makeAuthHeader(server.db, seededUsers.globalAdmin.id));
    },
    { scope: 'file' }
  ]
});

const contractCostMetric = {
  sourceSchemaId: seededSchemas.default.contract.id,
  source: { kind: 'field' as const, fieldId: 'annual_cost' },
  aggregation: 'sum' as const
};

test.describe('metric rollups', () => {
  test('rolls up seeded Vendor to Contract currency costs through containment', async ({
    orpc
  }) => {
    const response = await orpc.metrics.rollup({
      params: { workspace: 'default' },
      body: {
        boxEntityIds: [
          seededEntities.default.acmeCloud.id,
          seededEntities.default.nordicSystems.id
        ],
        metric: contractCostMetric
      }
    });

    const results = new Map(response.results.map(result => [result.boxEntityId, result]));
    expect(results.get(seededEntities.default.acmeCloud.id)).toMatchObject({
      value: 155000,
      currencyCode: 'USD',
      currencyMixed: false,
      sourceCount: 2,
      populatedCount: 2
    });
    expect(results.get(seededEntities.default.nordicSystems.id)).toMatchObject({
      value: 42000,
      currencyCode: 'USD',
      currencyMixed: false,
      sourceCount: 1,
      populatedCount: 1
    });
    expect(response.legend).toMatchObject({
      currencyCode: 'USD',
      currencyMixed: false,
      min: 42000,
      max: 155000,
      currencyRateDate: '2026-08-07'
    });
  });

  test('averages homogeneous seeded currency costs', async ({ orpc }) => {
    const response = await orpc.metrics.rollup({
      params: { workspace: 'default' },
      body: {
        boxEntityIds: [seededEntities.default.acmeCloud.id],
        metric: { ...contractCostMetric, aggregation: 'average' }
      }
    });

    expect(response.results[0]).toMatchObject({
      value: 77500,
      currencyCode: 'USD',
      currencyMixed: false,
      currencyRateDate: '2026-08-07'
    });
    expect(response.legend).toMatchObject({
      currencyCode: 'USD',
      currencyMixed: false
    });
  });
});

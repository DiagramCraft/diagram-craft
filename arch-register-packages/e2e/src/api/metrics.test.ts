import { seededEntities, seededSchemas, seededUsers } from '@arch-register/server/db/seedFixtures';
import { createApiTest, expect } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';

const test = createApiTest({ seed: 'bootstrap' }).extend<{ auth: string }>({
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
      value: 84000,
      currencyCode: 'EUR',
      currencyMixed: false,
      sourceCount: 1,
      populatedCount: 1
    });
    expect(response.legend).toMatchObject({
      currencyCode: null,
      currencyMixed: true,
      min: 84000,
      max: 155000
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
      currencyMixed: false
    });
    expect(response.legend).toMatchObject({
      currencyCode: 'USD',
      currencyMixed: false
    });
  });
});

import { seededUsers } from '@arch-register/server/db/seedFixtures';
import { createApiTest, expect } from '../helpers/fixtures';
import { makeAuthHeader, seedIds } from '../helpers/seedHelper';
import type { TestORPCClient } from '../helpers/orpcTestClient';

const test = createApiTest({ seed: 'bootstrap' }).extend<{ auth: string }>({
  auth: [
    async ({ server }, use) => {
      await use(await makeAuthHeader(server.db, seededUsers.globalAdmin.id));
    },
    { scope: 'file' }
  ]
});

const DATA_ENTITY_SCHEMA_ID = '00000000-0000-0000-0000-000000000008';

const initialStewardship = {
  steward: { principal_type: 'user', principal_id: seedIds.users.securityteamadmin },
  custodian: { principal_type: 'team', principal_id: seedIds.teams.platform },
  review_date: '2026-10-01',
  regulatory_tags: ['gdpr', 'ccpa'],
  processing_purposes: ['analytics', 'customer-support'],
  permitted_residency_regions: ['eu', 'uk']
} as const;

const updatedStewardship = {
  steward: { principal_type: 'team', principal_id: seedIds.teams.security },
  custodian: { principal_type: 'user', principal_id: seedIds.users.securityteamadmin },
  review_date: '2026-11-15',
  regulatory_tags: ['pci-dss'],
  processing_purposes: ['fraud-prevention'],
  permitted_residency_regions: ['us']
} as const;

const createDataEntity = async (
  orpc: TestORPCClient,
  name: string,
  stewardship: typeof initialStewardship
) =>
  await orpc.entities.create({
    params: { workspace: 'default' },
    body: {
      _schemaId: DATA_ENTITY_SCHEMA_ID,
      _name: name,
      _namespace: 'default',
      _description: 'Information asset stewardship e2e fixture',
      _owner: seedIds.teams.platform,
      _lifecycle: seedIds.lifecycle.production,
      classification: 'sensitive',
      ...stewardship
    } as never
  });

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

test.describe('information asset stewardship fields', () => {
  test('creates and edits all stewardship fields on a Data Entity', async ({ orpc }) => {
    const created = await createDataEntity(
      orpc,
      'Stewardship Create Edit Asset',
      initialStewardship
    );

    expect(created).toMatchObject({
      _schema: expect.objectContaining({ id: DATA_ENTITY_SCHEMA_ID }),
      _name: 'Stewardship Create Edit Asset',
      classification: 'sensitive',
      ...initialStewardship
    });

    const updated = await orpc.entities.update({
      params: { workspace: 'default', id: created._uid },
      body: {
        _schemaId: DATA_ENTITY_SCHEMA_ID,
        _name: 'Stewardship Create Edit Asset Updated',
        _slug: 'stewardship-create-edit-asset-updated',
        _namespace: 'default',
        _description: 'Updated information asset stewardship e2e fixture',
        _owner: seedIds.teams.security,
        _lifecycle: seedIds.lifecycle.production,
        classification: 'non-sensitive',
        ...updatedStewardship
      } as never
    });

    expect(updated).toMatchObject({
      _uid: created._uid,
      _name: 'Stewardship Create Edit Asset Updated',
      classification: 'non-sensitive',
      ...updatedStewardship
    });
  });

  test('filters Data Entities by each stewardship field', async ({ orpc }) => {
    const cases = [
      {
        condition: {
          fieldId: 'steward',
          op: 'contains' as const,
          value: seedIds.users.securityteamadmin
        },
        expected: 'Customer Credentials',
        excluded: 'Transaction Events'
      },
      {
        condition: {
          fieldId: 'custodian',
          op: 'contains' as const,
          value: seedIds.teams.platform
        },
        expected: 'Customer Credentials',
        excluded: 'Transaction Events'
      },
      {
        condition: { fieldId: 'review_date', op: 'before' as const, value: '2026-01-01' },
        expected: 'Transaction Events',
        excluded: 'Customer Credentials'
      },
      {
        condition: { fieldId: 'regulatory_tags', op: 'contains' as const, value: 'gdpr' },
        expected: 'Customer Credentials',
        excluded: 'Transaction Events'
      },
      {
        condition: { fieldId: 'processing_purposes', op: 'contains' as const, value: 'analytics' },
        expected: 'Transaction Events',
        excluded: 'Customer Credentials'
      },
      {
        condition: {
          fieldId: 'permitted_residency_regions',
          op: 'contains' as const,
          value: 'eu'
        },
        expected: 'Customer Credentials',
        excluded: 'Transaction Events'
      },
      {
        condition: { fieldId: 'classification', op: 'equals' as const, value: 'sensitive' },
        expected: 'Customer Credentials',
        excluded: 'Transaction Events'
      }
    ];

    for (const { condition, expected, excluded } of cases) {
      const result = await orpc.entities.list({
        params: { workspace: 'default' },
        query: {
          _schemaId: DATA_ENTITY_SCHEMA_ID,
          conditions: [condition]
        }
      });
      const names = result.items.map(entity => entity._name);
      expect(names).toContain(expected);
      expect(names).not.toContain(excluded);
    }
  });

  test('round-trips principal values through CSV import and export', async ({
    server,
    auth,
    orpc
  }) => {
    const headers = [
      'Name',
      'Slug',
      'Namespace',
      'Description',
      'Owner',
      'Lifecycle',
      'Classification',
      'Steward',
      'Custodian',
      'Review Date',
      'Regulatory Tags',
      'Processing Purposes',
      'Permitted Residency Regions'
    ];
    const values = [
      'CSV Stewardship Asset',
      'csv-stewardship-asset',
      'default',
      'Imported through the stewardship CSV path',
      seedIds.teams.platform,
      seedIds.lifecycle.production,
      'sensitive',
      `user:${seedIds.users.securityteamadmin}`,
      `team:${seedIds.teams.platform}`,
      '2026-12-01',
      JSON.stringify(['gdpr', 'ccpa']),
      JSON.stringify(['customer-support']),
      JSON.stringify(['eu', 'us'])
    ];
    const csvContent = [headers.map(csvCell).join(';'), values.map(csvCell).join(';')].join('\n');

    const parsed = await orpc.entities.importParse({
      params: { workspace: 'default' },
      body: { schemaId: DATA_ENTITY_SCHEMA_ID, csvContent }
    });

    expect(parsed.validRows).toBe(1);
    const parsedEntity = parsed.entities[0]?.entity;
    expect(parsedEntity).toMatchObject({
      steward: { principal_type: 'user', principal_id: seedIds.users.securityteamadmin },
      custodian: { principal_type: 'team', principal_id: seedIds.teams.platform },
      regulatory_tags: ['gdpr', 'ccpa'],
      processing_purposes: ['customer-support'],
      permitted_residency_regions: ['eu', 'us']
    });
    if (parsedEntity == null) throw new Error('Expected CSV import to produce an entity');

    const committed = await orpc.entities.importCommit({
      params: { workspace: 'default' },
      body: { schemaId: DATA_ENTITY_SCHEMA_ID, entities: [parsedEntity] }
    });
    expect(committed).toMatchObject({ created: 1, updated: 0, ids: [expect.any(String)] });

    const response = await fetch(
      `${server.baseUrl}/api/application/v1/default/data/export?_schemaId=${DATA_ENTITY_SCHEMA_ID}`,
      { headers: { Authorization: auth } }
    );
    expect(response.status).toBe(200);
    const exported = await response.text();
    const importedLine = exported.split('\n').find(line => line.includes('CSV Stewardship Asset'));

    expect(importedLine).toBeDefined();
    expect(importedLine).toContain(`user:${seedIds.users.securityteamadmin}`);
    expect(importedLine).toContain(`team:${seedIds.teams.platform}`);
  });

  test('records steward, custodian, and review-date changes in the audit log', async ({
    server,
    orpc
  }) => {
    const created = await createDataEntity(orpc, 'Stewardship Audit Asset', initialStewardship);

    await orpc.entities.update({
      params: { workspace: 'default', id: created._uid },
      body: {
        _schemaId: DATA_ENTITY_SCHEMA_ID,
        _name: 'Stewardship Audit Asset',
        _slug: 'stewardship-audit-asset',
        _namespace: 'default',
        _description: 'Information asset stewardship e2e fixture',
        _owner: seedIds.teams.platform,
        _lifecycle: seedIds.lifecycle.production,
        classification: 'sensitive',
        ...updatedStewardship
      } as never
    });

    const logs = await server.db.audit.listAuditLogs(seedIds.workspace.default);
    const updateLog = logs.find(
      log => log.entity_id === created._uid && log.operation === 'update'
    );
    expect(updateLog).toMatchObject({
      changes: {
        old: {
          steward: initialStewardship.steward,
          custodian: initialStewardship.custodian,
          review_date: initialStewardship.review_date
        },
        new: {
          steward: updatedStewardship.steward,
          custodian: updatedStewardship.custodian,
          review_date: updatedStewardship.review_date
        }
      }
    });
  });
});

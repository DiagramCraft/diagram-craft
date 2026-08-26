import { seededUsers } from '@arch-register/server/db/seedFixtures';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
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

const DATA_FLOW_SCHEMA_ID = '00000000-0000-0000-0000-000000000030';
// Notification Hub / Search Platform — no seeded Data Flow relation already connects this pair,
// unlike Customer Portal/Identity Platform which the bootstrap seed already links (used here to
// avoid CSV natural-key ambiguity with pre-existing seeded relations).
const CUSTOMER_PORTAL_ID = '00000000-0000-0000-0002-000000000005';
const IDENTITY_PLATFORM_ID = '00000000-0000-0000-0002-000000000006';

const initialGovernance = {
  data_classification: 'sensitive',
  regulatory_tags: ['gdpr', 'ccpa'],
  processing_purposes: ['analytics', 'customer-support'],
  source_residency_region: 'eu',
  destination_residency_region: 'us'
} as const;

const updatedGovernance = {
  data_classification: 'non-sensitive',
  regulatory_tags: ['pci-dss'],
  processing_purposes: ['fraud-prevention'],
  source_residency_region: 'us',
  destination_residency_region: 'us'
} as const;

type DataFlowGovernance = {
  data_classification: string;
  regulatory_tags: readonly string[];
  processing_purposes: readonly string[];
  source_residency_region: string;
  destination_residency_region: string;
};

const createDataFlow = async (orpc: TestORPCClient, governance: DataFlowGovernance) =>
  await orpc.relations.create({
    params: { workspace: 'default' },
    body: {
      _schemaId: DATA_FLOW_SCHEMA_ID,
      _inEntityId: CUSTOMER_PORTAL_ID,
      _outEntityId: IDENTITY_PLATFORM_ID,
      direction: 'one-way',
      protocol: 'https-rest',
      ...governance
    } as never
  });

const queryDataFlows = async (orpc: TestORPCClient, root: EntityQuery['root']) =>
  await orpc.relations.query({
    params: { workspace: 'default' },
    query: {
      relationQuery: JSON.stringify({
        schemaId: DATA_FLOW_SCHEMA_ID,
        root
      }) as never
    }
  });

test.describe('data flow governance fields', () => {
  test('creates and edits all governance fields on a Data Flow', async ({ orpc }) => {
    const created = await createDataFlow(orpc, initialGovernance);

    expect(created).toMatchObject({
      _schema: expect.objectContaining({ id: DATA_FLOW_SCHEMA_ID }),
      ...initialGovernance
    });

    const updated = await orpc.relations.update({
      params: { workspace: 'default', id: created._uid },
      body: { ...updatedGovernance } as never
    });

    expect(updated).toMatchObject({
      _uid: created._uid,
      ...updatedGovernance
    });
  });

  test('filters Data Flows by each governance field', async ({ orpc }) => {
    const matching = await createDataFlow(orpc, initialGovernance);
    const nonMatching = await createDataFlow(orpc, updatedGovernance);

    const cases: Array<{ fieldId: string; op: 'equals' | 'contains'; value: string }> = [
      { fieldId: 'data_classification', op: 'equals', value: 'sensitive' },
      { fieldId: 'regulatory_tags', op: 'contains', value: 'gdpr' },
      { fieldId: 'processing_purposes', op: 'contains', value: 'analytics' },
      { fieldId: 'source_residency_region', op: 'equals', value: 'eu' },
      { fieldId: 'destination_residency_region', op: 'equals', value: 'us' }
    ];

    for (const { fieldId, op, value } of cases) {
      const result = await queryDataFlows(orpc, {
        kind: 'predicate',
        path: [],
        fieldId,
        op,
        value
      });
      const ids = result.items.map(item => item['_uid']);
      expect(ids).toContain(matching._uid);
      if (fieldId !== 'destination_residency_region') {
        expect(ids).not.toContain(nonMatching._uid);
      }
    }
  });

  test('round-trips governance fields through CSV export and import', async ({ orpc }) => {
    // A dedicated, otherwise-unused System pair (distinct from the seeded Data Flow instances and
    // from the pair the other tests in this file create relations for) so CSV natural-key matching
    // ('schema + in + out') stays unambiguous regardless of what earlier tests created.
    const csvInEntityId = '00000000-0000-0000-0002-000000000002';
    const csvOutEntityId = '00000000-0000-0000-0002-000000000003';
    const created = await orpc.relations.create({
      params: { workspace: 'default' },
      body: {
        _schemaId: DATA_FLOW_SCHEMA_ID,
        _inEntityId: csvInEntityId,
        _outEntityId: csvOutEntityId,
        direction: 'one-way',
        protocol: 'https-rest',
        ...initialGovernance
      } as never
    });

    const exported = await orpc.relations.exportCsv({
      params: { workspace: 'default' },
      query: {
        relationQuery: JSON.stringify({
          schemaId: DATA_FLOW_SCHEMA_ID,
          root: { kind: 'and', children: [] }
        }) as never
      }
    });
    const csv = await exported.body.text();
    expect(csv).toContain('Regulatory Tags');
    expect(csv).toContain('Destination Residency Region');

    const headerLine = csv.split('\n')[0]!;
    const dataLine = csv
      .split('\n')
      .find(
        line =>
          line.includes(`${csvInEntityId}`) &&
          line.includes(`${csvOutEntityId}`) &&
          line.includes('gdpr')
      );
    expect(dataLine).toBeDefined();

    const parsed = await orpc.relations.importParse({
      params: { workspace: 'default' },
      body: {
        csvContent: `${headerLine}\n${dataLine!.replace('gdpr, ccpa', 'pci-dss')}`
      }
    });
    expect(parsed.validRows).toBe(1);
    const parsedRelation = parsed.relations[0]?.relation;
    expect(parsedRelation).toMatchObject({ regulatory_tags: ['pci-dss'] });
    if (parsedRelation == null) throw new Error('Expected CSV import to produce a relation');

    const committed = await orpc.relations.importCommit({
      params: { workspace: 'default' },
      body: { relations: [parsedRelation] }
    });
    expect(committed).toMatchObject({ created: 0, updated: 1, ids: [created._uid] });
  });

  test('records governance field changes in the audit log', async ({ server, orpc }) => {
    const created = await createDataFlow(orpc, initialGovernance);

    await orpc.relations.update({
      params: { workspace: 'default', id: created._uid },
      body: { ...updatedGovernance } as never
    });

    const logs = await server.db.audit.listAuditLogs(seedIds.workspace.default);
    const updateLog = logs.find(
      log => log.entity_id === created._uid && log.operation === 'update'
    );
    expect(updateLog).toMatchObject({
      entity_type: 'relation',
      changes: {
        old: {
          data_classification: initialGovernance.data_classification,
          regulatory_tags: initialGovernance.regulatory_tags,
          source_residency_region: initialGovernance.source_residency_region
        },
        new: {
          data_classification: updatedGovernance.data_classification,
          regulatory_tags: updatedGovernance.regulatory_tags,
          source_residency_region: updatedGovernance.source_residency_region
        }
      }
    });
  });
});

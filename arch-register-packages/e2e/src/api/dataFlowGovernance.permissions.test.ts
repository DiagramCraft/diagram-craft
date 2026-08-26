import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest();

const DATA_FLOW_SCHEMA_ID = '00000000-0000-0000-0000-000000000030';
const DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID = '00000000-0000-0000-0000-f00000000003';
const CUSTOMER_PORTAL_ID = '00000000-0000-0000-0002-000000000001';
const IDENTITY_PLATFORM_ID = '00000000-0000-0000-0002-000000000002';
const RESTRICTED_FIELD_IDS = [
  'regulatory_tags',
  'processing_purposes',
  'source_residency_region',
  'destination_residency_region'
] as const;

const restrictedDataFlowGovernanceTest = test.extend<{ restrictedDataFlowGovernance: true }>({
  restrictedDataFlowGovernance: [
    async ({ server, resources }, use) => {
      const schema = await server.db.relation.getRelationSchema(
        resources.workspaceId,
        DATA_FLOW_SCHEMA_ID
      );
      if (!schema) throw new Error('Expected seeded Data Flow relation schema to exist');

      await server.db.relation.updateRelationSchema(resources.workspaceId, schema.id, {
        name: schema.name,
        category: schema.category,
        description: schema.description,
        in_schema_ids: schema.in_schema_ids,
        out_schema_ids: schema.out_schema_ids,
        in_label: schema.in_label,
        out_label: schema.out_label,
        fields: schema.fields,
        groups: (schema.groups ?? []).map(group =>
          group.id === DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID
            ? { ...group, accessControl: { teamIds: [resources.teamIds.security] } }
            : group
        ),
        shared_field_group_links: schema.shared_field_group_links ?? [],
        color: schema.color,
        icon: schema.icon,
        relation_approval_policy: schema.relation_approval_policy,
        version: (schema.version ?? 1) + 1,
        updated_at: new Date()
      });

      await use(true);
    },
    { scope: 'file' }
  ]
});

restrictedDataFlowGovernanceTest.describe('data flow governance field-group permissions', () => {
  restrictedDataFlowGovernanceTest(
    'hides the restricted governance group from users without team access',
    async ({ personas, restrictedDataFlowGovernance: _ }) => {
      const created = await personas.securityTeamAdmin.orpc.relations.create({
        params: { workspace: 'default' },
        body: {
          _schemaId: DATA_FLOW_SCHEMA_ID,
          _inEntityId: CUSTOMER_PORTAL_ID,
          _outEntityId: IDENTITY_PLATFORM_ID,
          direction: 'one-way',
          data_classification: 'sensitive',
          protocol: 'https-rest',
          regulatory_tags: ['gdpr'],
          processing_purposes: ['analytics'],
          source_residency_region: 'eu',
          destination_residency_region: 'us'
        } as never
      });

      const fetched = await personas.workspaceEditor.orpc.relations.get({
        params: { workspace: 'default', id: created._uid }
      });
      expect(fetched).toMatchObject({
        _uid: created._uid,
        data_classification: 'sensitive'
      });
      for (const fieldId of RESTRICTED_FIELD_IDS) {
        expect(fetched).not.toHaveProperty(fieldId);
      }

      const listed = await personas.workspaceEditor.orpc.relations.list({
        params: { workspace: 'default' },
        query: { schemaId: DATA_FLOW_SCHEMA_ID }
      });
      const listedRelation = listed.items.find(relation => relation._uid === created._uid);
      expect(listedRelation).toMatchObject({ data_classification: 'sensitive' });
      for (const fieldId of RESTRICTED_FIELD_IDS) {
        expect(listedRelation).not.toHaveProperty(fieldId);
      }

      const authorized = await personas.securityTeamAdmin.orpc.relations.get({
        params: { workspace: 'default', id: created._uid }
      });
      expect(authorized).toMatchObject({
        regulatory_tags: ['gdpr'],
        processing_purposes: ['analytics'],
        source_residency_region: 'eu',
        destination_residency_region: 'us'
      });
    }
  );

  restrictedDataFlowGovernanceTest(
    'rejects restricted governance creates and updates without persisting them',
    async ({ server, personas, resources, restrictedDataFlowGovernance: _ }) => {
      await expect(
        personas.workspaceEditor.orpc.relations.create({
          params: { workspace: 'default' },
          body: {
            _schemaId: DATA_FLOW_SCHEMA_ID,
            _inEntityId: CUSTOMER_PORTAL_ID,
            _outEntityId: IDENTITY_PLATFORM_ID,
            direction: 'one-way',
            data_classification: 'sensitive',
            regulatory_tags: ['gdpr']
          } as never
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const created = await personas.securityTeamAdmin.orpc.relations.create({
        params: { workspace: 'default' },
        body: {
          _schemaId: DATA_FLOW_SCHEMA_ID,
          _inEntityId: CUSTOMER_PORTAL_ID,
          _outEntityId: IDENTITY_PLATFORM_ID,
          direction: 'one-way',
          data_classification: 'sensitive',
          regulatory_tags: ['gdpr']
        } as never
      });

      await expect(
        personas.workspaceEditor.orpc.relations.update({
          params: { workspace: 'default', id: created._uid },
          body: { regulatory_tags: ['pci-dss'] } as never
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const afterUpdate = await server.db.relation.getRelation(resources.workspaceId, created._uid);
      expect(afterUpdate?.data.regulatory_tags).toEqual(['gdpr']);
    }
  );
});

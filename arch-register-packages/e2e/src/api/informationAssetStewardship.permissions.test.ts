import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createPermissionApiTest();

const DATA_ENTITY_SCHEMA_ID = '00000000-0000-0000-0000-000000000008';
const CUSTOMER_CREDENTIALS_ID = '00000000-0000-0000-0008-000000000001';
const INFORMATION_ASSET_FIELD_GROUP_ID = '00000000-0000-0000-0000-f00000000002';
const RESTRICTED_FIELD_IDS = [
  'steward',
  'custodian',
  'review_date',
  'regulatory_tags',
  'processing_purposes',
  'permitted_residency_regions'
] as const;

const restrictedStewardshipTest = test.extend<{ restrictedStewardship: true }>({
  restrictedStewardship: [
    async ({ server, resources }, use) => {
      const schema = await server.db.catalog.getSchema(
        resources.workspaceId,
        DATA_ENTITY_SCHEMA_ID
      );
      if (!schema) throw new Error('Expected seeded Data Entity schema to exist');

      await server.db.catalog.updateSchema(resources.workspaceId, schema.id, {
        name: schema.name,
        description: schema.description,
        fields: schema.fields,
        templates: schema.templates,
        groups: (schema.groups ?? []).map(group =>
          group.id === INFORMATION_ASSET_FIELD_GROUP_ID
            ? { ...group, accessControl: { teamIds: [resources.teamIds.security] } }
            : group
        ),
        shared_field_group_links: (schema.shared_field_group_links ?? []).map(link =>
          link.groupId === INFORMATION_ASSET_FIELD_GROUP_ID
            ? { ...link, teamIds: [resources.teamIds.security] }
            : link
        ),
        color: schema.color,
        icon: schema.icon,
        default_owner: schema.default_owner,
        key_prefix: schema.key_prefix,
        entity_approval_policy: schema.entity_approval_policy,
        deprecation_policy: schema.deprecation_policy,
        version: (schema.version ?? 1) + 1,
        updated_at: new Date()
      });

      await use(true);
    },
    { scope: 'file' }
  ]
});

const restrictedUpdate = {
  _schemaId: DATA_ENTITY_SCHEMA_ID,
  _name: 'Customer Credentials',
  _slug: 'customer-credentials',
  _namespace: 'default',
  _description: 'Username/password or session token used to authenticate a customer.',
  _owner: seedIds.teams.security,
  _lifecycle: seedIds.lifecycle.production
};

restrictedStewardshipTest.describe('information asset stewardship field-group permissions', () => {
  restrictedStewardshipTest(
    'hides the restricted stewardship group from users without team access',
    async ({ personas, resources, restrictedStewardship: _ }) => {
      const fetched = await personas.workspaceEditor.orpc.entities.get({
        params: { workspace: 'default', id: CUSTOMER_CREDENTIALS_ID }
      });
      expect(fetched).toMatchObject({
        _uid: CUSTOMER_CREDENTIALS_ID,
        classification: 'sensitive'
      });
      for (const fieldId of RESTRICTED_FIELD_IDS) {
        expect(fetched).not.toHaveProperty(fieldId);
      }

      const listed = await personas.workspaceEditor.orpc.entities.list({
        params: { workspace: 'default' },
        query: { _schemaId: DATA_ENTITY_SCHEMA_ID, view: 'full' }
      });
      const listedEntity = listed.items.find(entity => entity._uid === CUSTOMER_CREDENTIALS_ID);
      expect(listedEntity).toMatchObject({ classification: 'sensitive' });
      for (const fieldId of RESTRICTED_FIELD_IDS) {
        expect(listedEntity).not.toHaveProperty(fieldId);
      }

      const authorized = await personas.securityTeamAdmin.orpc.entities.get({
        params: { workspace: 'default', id: CUSTOMER_CREDENTIALS_ID }
      });
      expect(authorized).toMatchObject({
        steward: {
          principal_type: 'user'
        },
        custodian: {
          principal_type: 'team',
          principal_id: resources.teamIds.platform
        },
        review_date: '2026-09-10'
      });
    }
  );

  restrictedStewardshipTest(
    'rejects restricted stewardship creates and updates without persisting them',
    async ({ server, personas, resources, restrictedStewardship: _ }) => {
      await expect(
        personas.workspaceEditor.orpc.entities.create({
          params: { workspace: 'default' },
          body: {
            _schemaId: DATA_ENTITY_SCHEMA_ID,
            _name: 'Forbidden Stewardship Asset',
            _owner: resources.teamIds.platform,
            _lifecycle: seedIds.lifecycle.production,
            classification: 'sensitive',
            steward: { principal_type: 'user', principal_id: personas.workspaceEditor.userId },
            custodian: { principal_type: 'team', principal_id: resources.teamIds.platform },
            review_date: '2026-12-31',
            regulatory_tags: ['gdpr'],
            processing_purposes: ['analytics'],
            permitted_residency_regions: ['eu']
          } as never
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const afterCreate = await server.db.catalog.getEntity(
        resources.workspaceId,
        CUSTOMER_CREDENTIALS_ID
      );
      if (!afterCreate) throw new Error('Expected seeded Customer Credentials entity to exist');
      const beforeSteward = afterCreate.data.steward;

      await expect(
        personas.workspaceEditor.orpc.entities.update({
          params: { workspace: 'default', id: CUSTOMER_CREDENTIALS_ID },
          body: {
            ...restrictedUpdate,
            steward: { principal_type: 'team', principal_id: resources.teamIds.platform }
          } as never
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const afterUpdate = await server.db.catalog.getEntity(
        resources.workspaceId,
        CUSTOMER_CREDENTIALS_ID
      );
      expect(afterUpdate?.data.steward).toEqual(beforeSteward);
    }
  );
});

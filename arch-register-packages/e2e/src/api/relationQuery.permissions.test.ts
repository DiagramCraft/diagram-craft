import { randomUUID } from 'node:crypto';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import type { TestServer } from '../helpers/serverHelper';

type RelationPermissionFixture = {
  redactedRelationSchemaId: string;
  gatedRelationSchemaId: string;
};

const test = createPermissionApiTest().extend<{
  relationFixture: RelationPermissionFixture;
}>({
  relationFixture: [
    async ({ server, resources }, use) => {
      const now = new Date('2026-08-05T12:00:00.000Z');
      const endpointSchemaId = randomUUID();
      const redactedRelationSchemaId = randomUUID();
      const gatedRelationSchemaId = randomUUID();
      const restrictedEndpointGroupId = randomUUID();
      const restrictedRelationGroupId = randomUUID();
      const inEntityId = randomUUID();
      const outEntityId = randomUUID();

      await server.db.catalog.createSchema({
        id: endpointSchemaId,
        workspace: resources.workspaceId,
        name: 'Relation query permission endpoint',
        description: '',
        fields: [
          {
            id: 'gated_out',
            name: 'Gated outgoing relations',
            type: 'typedRelation',
            requirementLevel: null,
            relationSchemaId: gatedRelationSchemaId,
            direction: 'out',
            groupId: restrictedEndpointGroupId
          },
          {
            id: 'gated_in',
            name: 'Gated incoming relations',
            type: 'typedRelation',
            requirementLevel: null,
            relationSchemaId: gatedRelationSchemaId,
            direction: 'in',
            groupId: restrictedEndpointGroupId
          }
        ],
        templates: [],
        groups: [
          {
            id: restrictedEndpointGroupId,
            name: 'Restricted relation endpoint',
            accessControl: { teamIds: [resources.teamIds.security] }
          }
        ],
        shared_field_group_links: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: `RQ${randomUUID().replaceAll('-', '').slice(0, 3).toUpperCase()}`,
        created_at: now,
        updated_at: now
      });

      await server.db.relation.createRelationSchema({
        id: redactedRelationSchemaId,
        workspace: resources.workspaceId,
        name: 'Relation query redaction',
        description: '',
        in_schema_ids: [endpointSchemaId],
        out_schema_ids: [endpointSchemaId],
        fields: [
          { id: 'visible_note', name: 'Visible note', type: 'text', requirementLevel: null },
          {
            id: 'secret_note',
            name: 'Secret note',
            type: 'text',
            requirementLevel: null,
            groupId: restrictedRelationGroupId
          }
        ],
        groups: [
          {
            id: restrictedRelationGroupId,
            name: 'Restricted relation data',
            accessControl: { teamIds: [resources.teamIds.security] }
          }
        ],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      });

      await server.db.relation.createRelationSchema({
        id: gatedRelationSchemaId,
        workspace: resources.workspaceId,
        name: 'Relation query visibility',
        description: '',
        in_schema_ids: [endpointSchemaId],
        out_schema_ids: [endpointSchemaId],
        fields: [{ id: 'status', name: 'Status', type: 'text', requirementLevel: null }],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      });

      await server.db.catalog.createEntity({
        id: inEntityId,
        workspace: resources.workspaceId,
        public_id: `RQ-${randomUUID().slice(0, 8)}`,
        slug: 'relation-query-in',
        namespace: 'default',
        name: 'Relation Query In',
        description: '',
        owner: null,
        lifecycle: null,
        target_lifecycle: null,
        target_lifecycle_date: null,
        tags: [],
        links: [],
        schema_id: endpointSchemaId,
        data: {},
        project_id: null,
        created_at: now,
        updated_at: now,
        completeness: 0
      });
      await server.db.catalog.createEntity({
        id: outEntityId,
        workspace: resources.workspaceId,
        public_id: `RQ-${randomUUID().slice(0, 8)}`,
        slug: 'relation-query-out',
        namespace: 'default',
        name: 'Relation Query Out',
        description: '',
        owner: null,
        lifecycle: null,
        target_lifecycle: null,
        target_lifecycle_date: null,
        tags: [],
        links: [],
        schema_id: endpointSchemaId,
        data: {},
        project_id: null,
        created_at: now,
        updated_at: now,
        completeness: 0
      });

      await server.db.relation.createRelation({
        id: randomUUID(),
        workspace: resources.workspaceId,
        schema_id: redactedRelationSchemaId,
        in_entity_id: inEntityId,
        out_entity_id: outEntityId,
        data: { visible_note: 'visible', secret_note: 'secret' },
        created_at: now,
        updated_at: now
      });
      await server.db.relation.createRelation({
        id: randomUUID(),
        workspace: resources.workspaceId,
        schema_id: gatedRelationSchemaId,
        in_entity_id: inEntityId,
        out_entity_id: outEntityId,
        data: { status: 'active' },
        created_at: now,
        updated_at: now
      });

      await use({ redactedRelationSchemaId, gatedRelationSchemaId });
    },
    { scope: 'file' }
  ]
});

const queryRelations = async (server: TestServer, auth: string, relationQuery: EntityQuery) => {
  const params = new URLSearchParams({ relationQuery: JSON.stringify(relationQuery) });
  const response = await fetch(
    `${server.baseUrl}/api/application/v1/default/relations/query?${params}`,
    { headers: { Authorization: auth } }
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    items: Array<Record<string, unknown>>;
    total: number;
  };
};

test.describe('RelationQuery permission routes', () => {
  test('redacts restricted relation fields over HTTP', async ({
    server,
    personas,
    relationFixture
  }) => {
    const relationQuery: EntityQuery = {
      schemaId: relationFixture.redactedRelationSchemaId,
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'not_empty', value: '' }
    };

    const viewerPage = await queryRelations(server, personas.workspaceViewer.auth, relationQuery);
    expect(viewerPage.total).toBe(1);
    expect(viewerPage.items[0]).toMatchObject({ visible_note: 'visible' });
    expect(viewerPage.items[0]).not.toHaveProperty('secret_note');

    const securityPage = await queryRelations(
      server,
      personas.securityTeamAdmin.auth,
      relationQuery
    );
    expect(securityPage.total).toBe(1);
    expect(securityPage.items[0]).toMatchObject({
      visible_note: 'visible',
      secret_note: 'secret'
    });
  });

  test('gates relation-rooted results by endpoint visibility over HTTP', async ({
    server,
    personas,
    relationFixture
  }) => {
    const relationQuery: EntityQuery = {
      schemaId: relationFixture.gatedRelationSchemaId,
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'not_empty', value: '' }
    };

    const viewerPage = await queryRelations(server, personas.workspaceViewer.auth, relationQuery);
    expect(viewerPage.items).toEqual([]);
    expect(viewerPage.total).toBe(0);

    const securityPage = await queryRelations(
      server,
      personas.securityTeamAdmin.auth,
      relationQuery
    );
    expect(securityPage.total).toBe(1);
    expect(securityPage.items[0]).toMatchObject({ status: 'active' });
  });
});

import { randomUUID } from 'node:crypto';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import type { TestServer } from '../helpers/serverHelper';

type RelationPermissionFixture = {
  endpointSchemaId: string;
  redactedRelationSchemaId: string;
  gatedRelationSchemaId: string;
  historicalRelationSchemaId: string;
  historicalAsOf: string;
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
      const historicalRelationSchemaId = randomUUID();
      const restrictedEndpointGroupId = randomUUID();
      const restrictedRelationGroupId = randomUUID();
      const historicalRelationGroupId = randomUUID();
      const inEntityId = randomUUID();
      const outEntityId = randomUUID();
      const historicalAsOfDate = new Date(now.getTime() + 60_000);

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
          },
          {
            id: 'historical_out',
            name: 'Historical outgoing relation',
            type: 'typedRelation',
            requirementLevel: null,
            relationSchemaId: historicalRelationSchemaId,
            direction: 'out'
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

      const historicalRelationSchema = await server.db.relation.createRelationSchema({
        id: historicalRelationSchemaId,
        workspace: resources.workspaceId,
        name: 'Historical relation query',
        description: '',
        in_schema_ids: [endpointSchemaId],
        out_schema_ids: [endpointSchemaId],
        fields: [
          { id: 'visible_note', name: 'Visible note', type: 'text', requirementLevel: null },
          { id: 'secret_note', name: 'Secret note', type: 'text', requirementLevel: null }
        ],
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
      await server.db.relation.createRelation({
        id: randomUUID(),
        workspace: resources.workspaceId,
        schema_id: historicalRelationSchemaId,
        in_entity_id: inEntityId,
        out_entity_id: outEntityId,
        data: { visible_note: 'historical visible', secret_note: 'historical secret' },
        created_at: now,
        updated_at: now
      });

      await server.db.relation.createRelationSchemaVersion({
        id: randomUUID(),
        workspace: resources.workspaceId,
        schema_id: historicalRelationSchema.id,
        version: (historicalRelationSchema.version ?? 1) + 1,
        name: historicalRelationSchema.name,
        description: historicalRelationSchema.description,
        in_schema_ids: historicalRelationSchema.in_schema_ids,
        out_schema_ids: historicalRelationSchema.out_schema_ids,
        fields: historicalRelationSchema.fields.map(field =>
          field.id === 'secret_note' ? { ...field, groupId: historicalRelationGroupId } : field
        ),
        groups: [
          {
            id: historicalRelationGroupId,
            name: 'Historical restricted relation data',
            accessControl: { teamIds: [resources.teamIds.security] }
          }
        ],
        color: historicalRelationSchema.color,
        icon: historicalRelationSchema.icon,
        change_summary: {},
        created_by: null,
        created_at: historicalAsOfDate
      });

      await use({
        endpointSchemaId,
        redactedRelationSchemaId,
        gatedRelationSchemaId,
        historicalRelationSchemaId,
        historicalAsOf: new Date(historicalAsOfDate.getTime() + 1_000).toISOString()
      });
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

  test('uses the historical relation ACL for relation-rooted list, count, and CSV export', async ({
    server,
    personas,
    relationFixture
  }) => {
    const relationQuery: EntityQuery = {
      asOf: relationFixture.historicalAsOf,
      schemaId: relationFixture.historicalRelationSchemaId,
      root: { kind: 'and', children: [] }
    };

    const [viewerPage, viewerCount] = await Promise.all([
      queryRelations(server, personas.workspaceViewer.auth, relationQuery),
      personas.workspaceViewer.orpc.relations.query({
        params: { workspace: 'default' },
        query: { relationQuery: JSON.stringify(relationQuery) }
      })
    ]);
    expect(viewerPage.total).toBe(1);
    expect(viewerCount.total).toBe(1);
    expect(viewerPage.items[0]).toMatchObject({ visible_note: 'historical visible' });
    expect(viewerPage.items[0]).not.toHaveProperty('secret_note');

    const viewerCsv = await personas.workspaceViewer.orpc.relations.exportCsv({
      params: { workspace: 'default' },
      query: { relationQuery: JSON.stringify(relationQuery) }
    });
    const viewerCsvText = await viewerCsv.body.text();
    expect(viewerCsvText.split('\n')[0]).toContain('Visible note');
    expect(viewerCsvText).not.toContain('Secret note');
    expect(viewerCsvText).not.toContain('historical secret');

    const securityPage = await queryRelations(
      server,
      personas.securityTeamAdmin.auth,
      relationQuery
    );
    expect(securityPage.items[0]).toMatchObject({
      visible_note: 'historical visible',
      secret_note: 'historical secret'
    });

    const securityCsv = await personas.securityTeamAdmin.orpc.relations.exportCsv({
      params: { workspace: 'default' },
      query: { relationQuery: JSON.stringify(relationQuery) }
    });
    const securityCsvText = await securityCsv.body.text();
    expect(securityCsvText.split('\n')[0]).toContain('Secret note');
    expect(securityCsvText).toContain('historical secret');
  });

  test('blocks typed-relation projections against historically restricted relation fields', async ({
    server,
    personas,
    relationFixture
  }) => {
    const query: EntityQuery = {
      asOf: relationFixture.historicalAsOf,
      root: { kind: 'and', children: [] },
      projections: [
        {
          path: [
            {
              kind: 'typedRelation',
              fieldId: 'historical_out',
              relationSchemaId: relationFixture.historicalRelationSchemaId,
              direction: 'out',
              ownerSchemaIds: [relationFixture.endpointSchemaId]
            }
          ],
          fieldId: 'secret_note',
          source: 'relation'
        }
      ]
    };

    const viewerResponse = await fetch(
      `${server.baseUrl}/api/application/v1/default/data?${new URLSearchParams({
        entityQuery: JSON.stringify(query)
      })}`,
      { headers: { Authorization: personas.workspaceViewer.auth } }
    );
    expect(viewerResponse.status).toBe(400);

    const securityResponse = await fetch(
      `${server.baseUrl}/api/application/v1/default/data?${new URLSearchParams({
        entityQuery: JSON.stringify(query)
      })}`,
      { headers: { Authorization: personas.securityTeamAdmin.auth } }
    );
    expect(securityResponse.status).toBe(200);
    const securityPage = (await securityResponse.json()) as {
      items: Array<{ _projections?: Record<string, unknown> }>;
    };
    const projected = securityPage.items.find(
      entity =>
        Array.isArray(entity._projections?.['historical_out.secret_note']) &&
        entity._projections['historical_out.secret_note'].length > 0
    );
    expect(projected?._projections?.['historical_out.secret_note']).toContain('historical secret');
  });
});

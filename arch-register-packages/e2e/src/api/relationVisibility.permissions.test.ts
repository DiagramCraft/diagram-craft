import { randomUUID } from 'node:crypto';
import { createApiTest, expect } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';

type RelationVisibilityFixture = {
  relationId: string;
  relationSchemaId: string;
  inEntityId: string;
  outEntityId: string;
};

const test = createApiTest().extend<{ relationFixture: RelationVisibilityFixture }>({
  relationFixture: [
    async ({ server, orpc }, use) => {
      const missingEndpointSchema = await orpc.schemas.create({
        params: { workspace: 'default' },
        body: { name: `Deleted relation endpoint ${randomUUID()}` }
      });
      const knownUnboundSchema = await orpc.schemas.create({
        params: { workspace: 'default' },
        body: { name: `Unbound relation endpoint ${randomUUID()}` }
      });
      const inEntity = await orpc.entities.create({
        params: { workspace: 'default' },
        body: {
          _schemaId: missingEndpointSchema.id,
          _name: 'Dangling relation source'
        } as never
      });
      const outEntity = await orpc.entities.create({
        params: { workspace: 'default' },
        body: {
          _schemaId: knownUnboundSchema.id,
          _name: 'Known unbound relation target'
        } as never
      });
      const relationSchemaId = randomUUID();
      const relationId = randomUUID();
      const now = new Date('2026-08-05T12:00:00.000Z');

      await server.db.relation.createRelationSchema({
        id: relationSchemaId,
        workspace: seedIds.workspace.default,
        name: 'Dangling endpoint relation',
        description: '',
        in_schema_ids: [knownUnboundSchema.id],
        out_schema_ids: [knownUnboundSchema.id],
        fields: [{ id: 'status', name: 'Status', type: 'text', requirementLevel: null }],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        version: 1,
        created_at: now,
        updated_at: now
      });
      await server.db.relation.createRelation({
        id: relationId,
        workspace: seedIds.workspace.default,
        schema_id: relationSchemaId,
        in_entity_id: inEntity._uid,
        out_entity_id: outEntity._uid,
        data: { status: 'dangling' },
        version: 1,
        approval_policy_override: null,
        created_at: now,
        updated_at: now
      });

      // Simulate an unavailable schema in the visibility catalog while retaining the entity row,
      // matching a dangling historical/imported reference without violating database FKs.
      const originalListSchemas = server.db.catalog.listSchemas.bind(server.db.catalog);
      const originalGetSchema = server.db.catalog.getSchema.bind(server.db.catalog);
      server.db.catalog.listSchemas = async workspace =>
        (await originalListSchemas(workspace)).filter(
          schema => schema.id !== missingEndpointSchema.id
        );
      server.db.catalog.getSchema = async (workspace, schemaId) =>
        schemaId === missingEndpointSchema.id ? null : originalGetSchema(workspace, schemaId);

      try {
        await use({
          relationId,
          relationSchemaId,
          inEntityId: inEntity._uid,
          outEntityId: outEntity._uid
        });
      } finally {
        server.db.catalog.listSchemas = originalListSchemas;
        server.db.catalog.getSchema = originalGetSchema;
      }
    },
    { scope: 'file' }
  ]
});

test.describe('typed relation visibility with missing endpoint schemas', () => {
  test('fails closed across public relation read surfaces', async ({ orpc, relationFixture }) => {
    const listed = await orpc.relations.list({
      params: { workspace: 'default' },
      query: {}
    });
    expect(listed).toEqual({ items: [], total: 0 });

    await expect(
      orpc.relations.get({
        params: { workspace: 'default', id: relationFixture.relationId }
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const entityRelations = await orpc.relations.listForEntity({
      params: { workspace: 'default', id: relationFixture.outEntityId }
    });
    expect(entityRelations).toEqual({ outgoing: [], incoming: [] });

    const search = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'Dangling relation', types: 'relations' }
    });
    expect(search.relations).toEqual([]);
  });

  test('does not leak the dangling relation as a Diagram Craft edge', async ({
    orpc,
    relationFixture
  }) => {
    const data = await orpc.diagramCraft.getData({ params: { workspace: 'default' } });
    const endpointData = data.filter(row =>
      [relationFixture.inEntityId, relationFixture.outEntityId].includes(String(row['_uid']))
    );

    expect(endpointData).toHaveLength(2);
    const outData = endpointData.find(row => row['_uid'] === relationFixture.outEntityId);
    expect(outData).toBeDefined();
    expect(Object.values(outData!)).not.toContain(relationFixture.inEntityId);
  });
});

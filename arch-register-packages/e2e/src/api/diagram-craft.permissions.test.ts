import { seedEntities } from '@arch-register/server/db/seedData/entities';
import { seedRelations } from '@arch-register/server/db/seedData/relations';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createPermissionApiTest();
const SYSTEM_SCHEMA_ID = '00000000-0000-0000-0000-000000000002';
const DATA_FLOW_SCHEMA_ID = '00000000-0000-0000-0000-000000000030';
const RESTRICTED_RELATION_FIELD_ID = 'data_flows_in_restricted';
const RESTRICTED_GROUP_ID = 'diagram-craft-restricted-relation';
const dataFlowRelation = seedRelations.find(
  relation => relation.schema_id === DATA_FLOW_SCHEMA_ID
)!;

test.describe('diagram craft permission routes', () => {
  test('authentication: public diagram craft routes still require auth', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/adapters/diagram-craft/default/schemas`);
    expect(res.status).toBe(401);
  });

  test('authorization: ws.view is required for schemas and data', async ({ server, personas }) => {
    const schemasRes = await fetch(`${server.baseUrl}/api/adapters/diagram-craft/default/schemas`, {
      headers: { Authorization: personas.outsider.auth }
    });
    expect(schemasRes.status).toBe(403);

    const dataRes = await fetch(`${server.baseUrl}/api/adapters/diagram-craft/default/data`, {
      headers: { Authorization: personas.outsider.auth }
    });
    expect(dataRes.status).toBe(403);
  });

  test('authorized users receive workspace data only', async ({ server, personas }) => {
    const dataRes = await fetch(`${server.baseUrl}/api/adapters/diagram-craft/default/data`, {
      headers: { Authorization: personas.workspaceViewer.auth }
    });

    expect(dataRes.status).toBe(200);
    const body = (await dataRes.json()) as Array<{ _name: string }>;
    const expectedNames = seedEntities
      .filter(entity => entity.workspace === seedIds.workspace.default && entity.project_id == null)
      .map(entity => entity.name)
      .sort();
    expect(body.map(entity => entity._name).sort()).toEqual(expectedNames);
  });

  test('redacts restricted duplicate typed-relation bindings individually', async ({
    server,
    personas
  }) => {
    const schema = await server.db.catalog.getSchema(seedIds.workspace.default, SYSTEM_SCHEMA_ID);
    if (!schema) throw new Error('Expected seeded System schema to exist');

    await server.db.catalog.updateSchema(seedIds.workspace.default, schema.id, {
      name: schema.name,
      description: schema.description,
      fields: [
        ...schema.fields,
        {
          id: RESTRICTED_RELATION_FIELD_ID,
          name: 'Restricted Data Flows In',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: DATA_FLOW_SCHEMA_ID,
          direction: 'in',
          groupId: RESTRICTED_GROUP_ID
        }
      ],
      templates: schema.templates ?? [],
      groups: [
        ...(schema.groups ?? []),
        {
          id: RESTRICTED_GROUP_ID,
          name: 'Restricted relation bindings',
          accessControl: { teamIds: [seedIds.teams.security] }
        }
      ],
      shared_field_group_links: schema.shared_field_group_links ?? [],
      color: schema.color,
      icon: schema.icon,
      default_owner: schema.default_owner,
      key_prefix: schema.key_prefix,
      entity_approval_policy: schema.entity_approval_policy,
      deprecation_policy: schema.deprecation_policy,
      version: (schema.version ?? 1) + 1,
      updated_at: new Date()
    });

    const dataRes = await fetch(`${server.baseUrl}/api/adapters/diagram-craft/default/data`, {
      headers: { Authorization: personas.workspaceViewer.auth }
    });

    expect(dataRes.status).toBe(200);
    const body = (await dataRes.json()) as Array<Record<string, unknown>>;
    const source = body.find(item => item['_uid'] === dataFlowRelation.in_entity_id);

    expect(source).toMatchObject({
      data_flows_in: expect.stringContaining(dataFlowRelation.out_entity_id)
    });
    expect(source).not.toHaveProperty(RESTRICTED_RELATION_FIELD_ID);
  });
});

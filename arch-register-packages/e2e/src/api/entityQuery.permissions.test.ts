import { randomUUID } from 'node:crypto';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { entityToBaseState } from '@arch-register/server/domain/catalog/entityMutations';
import type { TestServer } from '../helpers/serverHelper';

const test = createPermissionApiTest();

const componentSchemaId = '00000000-0000-0000-0000-000000000003';
const authServiceId = '00000000-0000-0000-0003-000000000003';
const PII_GROUP_ID = '00000000-0000-0000-0000-f00000000001';

const historicalAt = new Date('2026-01-15T12:00:00.000Z');
const currentAt = new Date('2026-01-16T12:00:00.000Z');

const createTemporalEntityVersion = async (
  server: TestServer,
  entity: Awaited<ReturnType<typeof server.db.catalog.getEntity>>,
  data: Record<string, unknown>
) => {
  if (!entity) throw new Error('Expected entity to exist');
  const versions = await server.db.catalog.listEntityVersions(entity.workspace, entity.id);
  return server.db.catalog.createEntityVersion({
    id: randomUUID(),
    workspace: entity.workspace,
    entity_id: entity.id,
    version_number: Math.max(...versions.map(version => version.version_number), 0) + 1,
    kind: 'saved_version',
    commit_message: null,
    created_at: historicalAt,
    created_by: null,
    state: entityToBaseState({ ...entity, data }),
    applied_case_revision_id: null
  });
};

const configureHistoricalSchema = async (
  server: TestServer,
  workspace: string,
  entityId: string,
  mode: 'relaxed' | 'removed',
  securityTeamId: string
) => {
  const entity = await server.db.catalog.getEntity(workspace, entityId);
  if (!entity) throw new Error('Expected entity to exist');
  const schema = await server.db.catalog.getSchema(workspace, entity.schema_id);
  if (!schema) throw new Error('Expected schema to exist');

  const historicalOnlyField = {
    id: 'historical_removed_secret',
    name: 'Historical removed secret',
    requirementLevel: null,
    type: 'text',
    groupId: 'historical-restricted'
  } as (typeof schema.fields)[number];
  const historicalFields =
    mode === 'removed' ? [...schema.fields, historicalOnlyField] : schema.fields;
  const historicalGroups = (schema.groups ?? []).map(group =>
    mode === 'relaxed' && group.id === PII_GROUP_ID
      ? { ...group, accessControl: { teamIds: [securityTeamId] } }
      : group
  );
  if (mode === 'removed') {
    historicalGroups.push({
      id: 'historical-restricted',
      name: 'Historical restricted',
      accessControl: { teamIds: [securityTeamId] }
    });
  }

  await server.db.catalog.createSchemaVersion({
    id: randomUUID(),
    workspace,
    schema_id: schema.id,
    version: (schema.version ?? 1) + 1,
    name: schema.name,
    description: schema.description,
    fields: historicalFields,
    templates: schema.templates ?? [],
    groups: historicalGroups,
    shared_field_group_links: schema.shared_field_group_links ?? [],
    color: schema.color,
    icon: schema.icon,
    change_summary: {},
    created_by: null,
    created_at: historicalAt
  });

  await server.db.catalog.updateSchema(workspace, schema.id, {
    name: schema.name,
    description: schema.description,
    fields:
      mode === 'removed'
        ? schema.fields.filter(field => field.id !== historicalOnlyField.id)
        : schema.fields,
    templates: schema.templates,
    groups: schema.groups,
    shared_field_group_links: schema.shared_field_group_links,
    color: schema.color,
    icon: schema.icon,
    default_owner: schema.default_owner,
    key_prefix: schema.key_prefix,
    entity_approval_policy: schema.entity_approval_policy,
    deprecation_policy: schema.deprecation_policy,
    version: (schema.version ?? 1) + 2,
    updated_at: currentAt
  });

  const data = {
    ...entity.data,
    ...(mode === 'removed'
      ? { historical_removed_secret: 'removed-secret' }
      : { pii_scope: 'historical-secret' })
  };
  await createTemporalEntityVersion(server, entity, data);
  return { entity, asOf: historicalAt.toISOString() };
};

test.describe('EntityQuery permission routes', () => {
  test('uses the historical ACL when the current schema is relaxed', async ({
    server,
    personas,
    resources
  }) => {
    const fixture = await configureHistoricalSchema(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal,
      'relaxed',
      resources.teamIds.security
    );
    const [listed, counted] = await Promise.all([
      personas.workspaceEditor.orpc.entities.list({
        params: { workspace: 'default' },
        query: { _schemaId: fixture.entity.schema_id, asOf: fixture.asOf }
      }),
      personas.workspaceEditor.orpc.entities.count({
        params: { workspace: 'default' },
        query: { _schemaId: fixture.entity.schema_id, asOf: fixture.asOf }
      })
    ]);

    const result = listed.items.find(item => item._uid === fixture.entity.id);
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('pii_scope', 'historical-secret');
    expect(counted.total).toBe(listed.total);
  });

  test('fails closed for a field removed from the current schema', async ({
    server,
    personas,
    resources
  }) => {
    const fixture = await configureHistoricalSchema(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal,
      'removed',
      resources.teamIds.security
    );
    const listed = await personas.workspaceEditor.orpc.entities.list({
      params: { workspace: 'default' },
      query: { _schemaId: fixture.entity.schema_id, asOf: fixture.asOf }
    });

    const result = listed.items.find(item => item._uid === fixture.entity.id);
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('historical_removed_secret');
  });

  test('does not let hidden related entities satisfy a traversal predicate', async ({
    personas
  }) => {
    const query: EntityQuery = {
      schemaId: componentSchemaId,
      root: {
        kind: 'predicate',
        path: [{ kind: 'forward', fieldId: 'depends_on' }],
        fieldId: '_id',
        op: 'equals',
        value: authServiceId
      }
    };

    const [list, count] = await Promise.all([
      personas.userWithExplicitEntityGrant.orpc.entities.list({
        params: { workspace: 'default' },
        query: { entityQuery: query }
      }),
      personas.userWithExplicitEntityGrant.orpc.entities.count({
        params: { workspace: 'default' },
        query: { entityQuery: query }
      })
    ]);

    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
    expect(count.total).toBe(0);
  });

  test('rejects EntityQuery project access for users without project access', async ({
    server,
    personas,
    resources
  }) => {
    const query: EntityQuery = { root: { kind: 'and', children: [] } };
    const response = await fetch(
      `${server.baseUrl}/api/application/v1/default/data?${new URLSearchParams({
        projectId: resources.projectIds.authMigration,
        projectScope: 'project',
        entityQuery: JSON.stringify(query)
      })}`,
      { headers: { Authorization: personas.workspaceViewer.auth } }
    );

    expect(response.status).toBe(403);
  });
});

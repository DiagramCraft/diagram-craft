import { randomUUID } from 'node:crypto';
import { hashPassword } from '@arch-register/server/utils/password';
import { entityToBaseState } from '@arch-register/server/domain/catalog/entityMutations';
import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { makeAuthHeader } from '../helpers/seedHelper';
import type { TestServer } from '../helpers/serverHelper';

const VIEW_ONLY_USER_ID = '00000000-0000-0000-0000-e2e000000011';
const VIEW_ONLY_PASSWORD = 'EntityVersionViewOnlyPassword123!';
const PII_GROUP_ID = '00000000-0000-0000-0000-f00000000001';

const test = createPermissionApiTest().extend<{
  viewOnlyOrpc: ReturnType<typeof createTestORPCClient>;
}>({
  viewOnlyOrpc: [
    async ({ server, resources }, use) => {
      const now = new Date();
      await server.db.auth.createUser({
        id: VIEW_ONLY_USER_ID,
        user_id: 'entity-version-view-only',
        email: 'entity-version-view-only@e2e.test',
        display_name: 'Entity Version View Only',
        auth_provider: 'local',
        password_hash: await hashPassword(VIEW_ONLY_PASSWORD),
        oidc_issuer: null,
        oidc_subject: null,
        is_active: true,
        color: null,
        created_at: now,
        updated_at: now,
        last_login_at: null
      });
      await server.db.workspace.setWorkspaceMemberRole(
        resources.workspaceId,
        VIEW_ONLY_USER_ID,
        'editor',
        now
      );
      await server.db.workspace.replaceTeamAssignments(resources.workspaceId, [
        ...(await server.db.workspace.listTeamAssignments(resources.workspaceId)),
        {
          workspace: resources.workspaceId,
          team_id: resources.teamIds.security,
          user_id: VIEW_ONLY_USER_ID,
          role: 'team_reviewer',
          created_at: now
        }
      ]);

      const auth = await makeAuthHeader(server.db, VIEW_ONLY_USER_ID);
      await use(createTestORPCClient(server.baseUrl, auth));
    },
    { scope: 'file' }
  ]
});

const testData = async (
  server: TestServer,
  workspace: string,
  entityId: string,
  securityTeamId: string
) => {
  const entity = await server.db.catalog.getEntity(workspace, entityId);
  if (!entity) throw new Error(`Expected entity '${entityId}' to exist`);
  const schema = await server.db.catalog.getSchema(workspace, entity.schema_id);
  if (!schema) throw new Error(`Expected schema '${entity.schema_id}' to exist`);

  const schemaUpdatedAt = new Date();
  const updatedSchema = await server.db.catalog.updateSchema(workspace, schema.id, {
    name: schema.name,
    description: schema.description,
    fields: schema.fields,
    templates: schema.templates,
    groups: (schema.groups ?? []).map(group =>
      group.id === PII_GROUP_ID ? { ...group, accessControl: { teamIds: [securityTeamId] } } : group
    ),
    shared_field_group_links: schema.shared_field_group_links,
    color: schema.color,
    icon: schema.icon,
    default_owner: schema.default_owner,
    key_prefix: schema.key_prefix,
    entity_approval_policy: schema.entity_approval_policy,
    deprecation_policy: schema.deprecation_policy,
    version: (schema.version ?? 1) + 1,
    updated_at: schemaUpdatedAt
  });
  if (!updatedSchema) throw new Error('Expected schema update to succeed');
  await server.db.catalog.createSchemaVersion({
    id: randomUUID(),
    workspace,
    schema_id: updatedSchema.id,
    version: updatedSchema.version ?? 1,
    name: updatedSchema.name,
    description: updatedSchema.description,
    fields: updatedSchema.fields,
    templates: updatedSchema.templates ?? [],
    groups: updatedSchema.groups ?? [],
    shared_field_group_links: updatedSchema.shared_field_group_links ?? [],
    color: updatedSchema.color,
    icon: updatedSchema.icon,
    change_summary: {},
    created_by: null,
    created_at: schemaUpdatedAt
  });

  const currentData = {
    ...entity.data,
    domain: ['current-visible'],
    pii_scope: 'current-secret'
  };
  const updatedEntity = await server.db.catalog.updateEntity(workspace, entity.id, {
    slug: entity.slug,
    namespace: entity.namespace,
    name: entity.name,
    description: entity.description,
    owner: entity.owner,
    lifecycle: entity.lifecycle,
    target_lifecycle: entity.target_lifecycle,
    target_lifecycle_date: entity.target_lifecycle_date,
    tags: entity.tags,
    links: entity.links,
    schema_id: entity.schema_id,
    data: currentData,
    project_id: entity.project_id,
    updated_at: new Date(),
    completeness: entity.completeness
  });
  if (!updatedEntity) throw new Error('Expected entity update to succeed');

  const existingVersions = await server.db.catalog.listEntityVersions(workspace, entity.id);
  let nextVersionNumber =
    Math.max(
      updatedEntity.version ?? 1,
      ...existingVersions.map(version => version.version_number)
    ) + 10;
  const makeVersion = async (kind: 'autosave' | 'saved_version', data: Record<string, unknown>) =>
    server.db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      record_id: entity.id,
      version_number: nextVersionNumber++,
      kind,
      commit_message: null,
      created_at: new Date(),
      created_by: null,
      state: entityToBaseState({ ...updatedEntity, data }),
      applied_case_revision_id: null
    });

  const promoteVersion = await makeVersion('autosave', {
    ...currentData,
    pii_scope: 'promote-secret'
  });
  const restoreChangedVersion = await makeVersion('saved_version', {
    ...currentData,
    domain: ['restored-visible'],
    pii_scope: 'restore-secret'
  });
  const restoreUnchangedVersion = await makeVersion('saved_version', {
    ...currentData,
    domain: ['restored-visible-only']
  });
  const unknownVersion = await makeVersion('saved_version', {
    ...currentData,
    obsolete_secret: 'historical-secret'
  });

  return {
    entity,
    promoteVersion,
    restoreChangedVersion,
    restoreUnchangedVersion,
    unknownVersion
  };
};

const historicalAclTestData = async (
  server: TestServer,
  workspace: string,
  entityId: string,
  securityTeamId: string
) => {
  const entity = await server.db.catalog.getEntity(workspace, entityId);
  if (!entity) throw new Error(`Expected entity '${entityId}' to exist`);
  const schema = await server.db.catalog.getSchema(workspace, entity.schema_id);
  if (!schema) throw new Error(`Expected schema '${entity.schema_id}' to exist`);

  const historicalAt = new Date('2026-07-30T12:00:00.000Z');
  const currentAt = new Date('2026-07-30T14:00:00.000Z');
  const historicalGroups = (schema.groups ?? []).map(group =>
    group.id === PII_GROUP_ID ? { ...group, accessControl: { teamIds: [securityTeamId] } } : group
  );
  const historicalVersion = (schema.version ?? 1) + 1;

  await server.db.catalog.createSchemaVersion({
    id: randomUUID(),
    workspace,
    schema_id: schema.id,
    version: historicalVersion,
    name: schema.name,
    description: schema.description,
    fields: schema.fields,
    templates: schema.templates ?? [],
    groups: historicalGroups,
    shared_field_group_links: schema.shared_field_group_links ?? [],
    color: schema.color,
    icon: schema.icon,
    change_summary: {},
    created_by: null,
    created_at: historicalAt
  });

  const currentSchema = await server.db.catalog.updateSchema(workspace, schema.id, {
    name: schema.name,
    description: schema.description,
    fields: schema.fields,
    templates: schema.templates,
    groups: schema.groups,
    shared_field_group_links: schema.shared_field_group_links,
    color: schema.color,
    icon: schema.icon,
    default_owner: schema.default_owner,
    key_prefix: schema.key_prefix,
    entity_approval_policy: schema.entity_approval_policy,
    deprecation_policy: schema.deprecation_policy,
    version: historicalVersion + 1,
    updated_at: currentAt
  });
  if (!currentSchema) throw new Error('Expected current schema update to succeed');

  const versions = await server.db.catalog.listEntityVersions(workspace, entity.id);
  const version = await server.db.catalog.createEntityVersion({
    id: randomUUID(),
    workspace,
    record_id: entity.id,
    version_number: Math.max(...versions.map(item => item.version_number), entity.version ?? 1) + 1,
    kind: 'saved_version',
    commit_message: null,
    created_at: new Date('2026-07-30T13:00:00.000Z'),
    created_by: null,
    state: entityToBaseState({
      ...entity,
      data: { ...entity.data, pii_scope: 'historical-secret' }
    }),
    applied_case_revision_id: null
  });

  return { entity, version };
};

const missingHistoricalSchemaTestData = async (
  server: TestServer,
  workspace: string,
  entityId: string
) => {
  const entity = await server.db.catalog.getEntity(workspace, entityId);
  if (!entity) throw new Error(`Expected entity '${entityId}' to exist`);
  const schema = await server.db.catalog.getSchema(workspace, entity.schema_id);
  if (!schema) throw new Error(`Expected schema '${entity.schema_id}' to exist`);

  const currentSchema = await server.db.catalog.updateSchema(workspace, schema.id, {
    name: schema.name,
    description: schema.description,
    fields: schema.fields,
    templates: schema.templates,
    groups: (schema.groups ?? []).map(group =>
      group.id === PII_GROUP_ID ? { ...group, accessControl: undefined } : group
    ),
    shared_field_group_links: schema.shared_field_group_links,
    color: schema.color,
    icon: schema.icon,
    default_owner: schema.default_owner,
    key_prefix: schema.key_prefix,
    entity_approval_policy: schema.entity_approval_policy,
    deprecation_policy: schema.deprecation_policy,
    version: (schema.version ?? 1) + 1,
    updated_at: new Date('2026-07-30T14:00:00.000Z')
  });
  if (!currentSchema) throw new Error('Expected current schema update to succeed');

  const versions = await server.db.catalog.listEntityVersions(workspace, entity.id);
  const version = await server.db.catalog.createEntityVersion({
    id: randomUUID(),
    workspace,
    record_id: entity.id,
    version_number:
      Math.max(...versions.map(item => item.version_number), entity.version ?? 1) + 100,
    kind: 'autosave',
    commit_message: null,
    created_at: new Date('1900-01-01T00:00:00.000Z'),
    created_by: null,
    state: entityToBaseState({
      ...entity,
      data: { ...entity.data, pii_scope: 'historical-secret' }
    }),
    applied_case_revision_id: null
  });

  return { entity, version };
};

test.describe('entity version field-group permissions', () => {
  test('list and get use the historical ACL when the current schema is less restrictive', async ({
    server,
    personas,
    resources
  }) => {
    const data = await historicalAclTestData(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal,
      resources.teamIds.security
    );

    const listed = await personas.workspaceEditor.orpc.entityVersions.list({
      params: { workspace: 'default', id: data.entity.id }
    });
    const listedVersion = listed.find(version => version.id === data.version.id);
    expect(listedVersion?.state.data).not.toHaveProperty('pii_scope');

    const fetched = await personas.workspaceEditor.orpc.entityVersions.get({
      params: {
        workspace: 'default',
        id: data.entity.id,
        versionId: data.version.id
      }
    });
    expect(fetched.state.data).not.toHaveProperty('pii_scope');
  });

  test('list and get omit data when the version schema is unavailable', async ({
    server,
    personas,
    resources
  }) => {
    const entity = await server.db.catalog.getEntity(
      resources.workspaceId,
      resources.entityIds.customerPortal
    );
    if (!entity) throw new Error('Expected entity to exist');
    const versions = await server.db.catalog.listEntityVersions(resources.workspaceId, entity.id);
    const missingSchemaVersion = await server.db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace: resources.workspaceId,
      record_id: entity.id,
      version_number:
        Math.max(...versions.map(version => version.version_number), entity.version ?? 1) + 1,
      kind: 'saved_version',
      commit_message: null,
      created_at: new Date(),
      created_by: null,
      state: {
        ...entityToBaseState(entity),
        schema_id: randomUUID(),
        data: { ...entity.data, missing_schema_secret: 'must-not-leak' }
      },
      applied_case_revision_id: null
    });

    const listed = await personas.workspaceEditor.orpc.entityVersions.list({
      params: { workspace: 'default', id: entity.id }
    });
    const listedVersion = listed.find(version => version.id === missingSchemaVersion.id);
    expect(listedVersion?.state.data).toEqual({});

    const fetched = await personas.workspaceEditor.orpc.entityVersions.get({
      params: {
        workspace: 'default',
        id: entity.id,
        versionId: missingSchemaVersion.id
      }
    });
    expect(fetched.state.data).toEqual({});
  });

  test('promote omits data when the historical schema is unavailable', async ({
    server,
    personas,
    resources
  }) => {
    const data = await missingHistoricalSchemaTestData(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal
    );

    const promoted = await personas.workspaceEditor.orpc.entityVersions.promote({
      params: {
        workspace: 'default',
        id: data.entity.id,
        versionId: data.version.id
      },
      body: {}
    });

    expect(promoted.state.data).toEqual({});
    const stored = await server.db.catalog.getEntityVersionById(
      resources.workspaceId,
      data.version.id
    );
    expect(stored?.kind).toBe('saved_version');
  });

  test('restore rejects when the historical schema is unavailable', async ({
    server,
    personas,
    resources
  }) => {
    const data = await missingHistoricalSchemaTestData(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal
    );
    const beforeEntity = await server.db.catalog.getEntity(resources.workspaceId, data.entity.id);
    const before = await server.db.audit.listAuditLogs(resources.workspaceId);

    await expect(
      personas.workspaceEditor.orpc.entityVersions.restore({
        params: {
          workspace: 'default',
          id: data.entity.id,
          versionId: data.version.id
        },
        body: {}
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const afterEntity = await server.db.catalog.getEntity(resources.workspaceId, data.entity.id);
    const after = await server.db.audit.listAuditLogs(resources.workspaceId);
    expect(afterEntity?.data).toEqual(beforeEntity?.data);
    expect(after).toHaveLength(before.length);
  });

  test('promote redacts restricted values for a caller without field-group view access', async ({
    server,
    personas,
    resources
  }) => {
    const data = await testData(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal,
      resources.teamIds.security
    );

    const promoted = await personas.workspaceEditor.orpc.entityVersions.promote({
      params: {
        workspace: 'default',
        id: data.entity.id,
        versionId: data.promoteVersion.id
      },
      body: {}
    });

    expect(promoted.state.data).toMatchObject({ domain: ['current-visible'] });
    expect(promoted.state.data).not.toHaveProperty('pii_scope');
  });

  test('restore rejects a restricted-field change without edit access and creates no audit record', async ({
    server,
    personas,
    resources
  }) => {
    const data = await testData(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal,
      resources.teamIds.security
    );
    const before = await server.db.audit.listAuditLogs(resources.workspaceId);

    await expect(
      personas.workspaceEditor.orpc.entityVersions.restore({
        params: {
          workspace: 'default',
          id: data.entity.id,
          versionId: data.restoreChangedVersion.id
        },
        body: { commitMessage: 'Should be rejected' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const afterEntity = await server.db.catalog.getEntity(resources.workspaceId, data.entity.id);
    const after = await server.db.audit.listAuditLogs(resources.workspaceId);
    expect(afterEntity?.data.pii_scope).toBe('current-secret');
    expect(after).toHaveLength(before.length);
  });

  test('view-only field-group access can restore unchanged restricted data but redacts it in the response', async ({
    viewOnlyOrpc,
    server,
    resources
  }) => {
    const data = await testData(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal,
      resources.teamIds.security
    );

    const restored = await viewOnlyOrpc.entityVersions.restore({
      params: {
        workspace: 'default',
        id: data.entity.id,
        versionId: data.restoreUnchangedVersion.id
      },
      body: {}
    });

    expect(restored.state.data).toMatchObject({ domain: ['restored-visible-only'] });
    expect(restored.state.data).toHaveProperty('pii_scope', 'current-secret');
  });

  test('field-group editors can restore restricted data and retain restore audit metadata', async ({
    server,
    personas,
    resources
  }) => {
    const data = await testData(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal,
      resources.teamIds.security
    );

    const restored = await personas.securityTeamAdmin.orpc.entityVersions.restore({
      params: {
        workspace: 'default',
        id: data.entity.id,
        versionId: data.restoreChangedVersion.id
      },
      body: { commitMessage: 'Restore restricted value' }
    });

    expect(restored.state.data).toMatchObject({
      domain: ['restored-visible'],
      pii_scope: 'restore-secret'
    });
    const logs = await server.db.audit.listAuditLogs(resources.workspaceId);
    const restoreLog = logs.find(
      log =>
        log.entity_id === data.entity.id &&
        log.metadata.restore_from_version_id === data.restoreChangedVersion.id
    );
    expect(restoreLog?.metadata).toMatchObject({
      restore_from_version_id: data.restoreChangedVersion.id,
      restore_commit_message: 'Restore restricted value'
    });
  });

  test('unknown historical fields cannot bypass restore authorization', async ({
    server,
    personas,
    resources
  }) => {
    const data = await testData(
      server,
      resources.workspaceId,
      resources.entityIds.customerPortal,
      resources.teamIds.security
    );

    await expect(
      personas.workspaceEditor.orpc.entityVersions.restore({
        params: {
          workspace: 'default',
          id: data.entity.id,
          versionId: data.unknownVersion.id
        },
        body: {}
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

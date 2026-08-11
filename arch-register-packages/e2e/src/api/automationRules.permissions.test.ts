import { randomUUID } from 'node:crypto';
import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { makeAuthHeader } from '../helpers/seedHelper';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';

const test = createPermissionApiTest();

test('people-management role cannot read restricted automation-rule literals', async ({
  server,
  personas,
  resources
}) => {
  const workspace = 'default';
  const workspaceId = resources.workspaceId;
  const now = new Date('2026-08-03T12:00:00.000Z');
  const schema = (await server.db.catalog.listSchemas(workspaceId)).find(schema =>
    schema.fields.some(field => field.id === 'pii_scope')
  );
  expect(schema).toBeDefined();
  if (!schema) return;

  await server.db.catalog.updateSchema(workspaceId, schema.id, {
    name: schema.name,
    description: schema.description,
    fields: schema.fields,
    templates: schema.templates,
    groups: (schema.groups ?? []).map(group =>
      group.id === '00000000-0000-0000-0000-f00000000001'
        ? { ...group, accessControl: { teamIds: [resources.teamIds.security] } }
        : group
    ),
    shared_field_group_links: schema.shared_field_group_links,
    color: schema.color,
    icon: schema.icon,
    default_owner: schema.default_owner,
    key_prefix: schema.key_prefix,
    entity_approval_policy: schema.entity_approval_policy,
    deprecation_policy: schema.deprecation_policy,
    version: (schema.version ?? 1) + 1,
    updated_at: now
  });

  const created = await personas.globalAdmin.orpc.automationRules.create({
    params: { workspace },
    body: {
      name: 'Restricted automation rule',
      description: 'Visible rule description',
      schema_id: schema.id,
      trigger: { kind: 'entity_created' },
      conditions: [{ field: 'pii_scope', operator: 'equals', value: 'secret-condition' }],
      actions: [
        { kind: 'create_audit_note', note: 'secret audit note' },
        {
          kind: 'send_notification',
          recipient: { kind: 'owner_team' },
          message: 'secret notification message'
        },
        { kind: 'set_field_value', field: 'pii_scope', value: 'secret-action' }
      ],
      enabled: true
    }
  });

  const userId = randomUUID();
  await createFixtureUser(server.db, {
    id: userId,
    user_id: 'people-manager',
    email: 'people-manager@e2e.test',
    display_name: 'People Manager',
    password_hash: null,
    is_active: true,
    created_at: now,
    updated_at: now
  });
  const roleId = randomUUID();
  await server.db.workspace.createCustomWorkspaceRole({
    id: roleId,
    workspace: workspaceId,
    name: 'People manager',
    description: '',
    tone: '',
    builtin: false,
    capabilities: ['people.role'],
    created_at: now,
    updated_at: now
  });
  await server.db.workspace.setWorkspaceMemberRole(workspaceId, userId, roleId, now);

  const peopleManager = createTestORPCClient(
    server.baseUrl,
    await makeAuthHeader(server.db, userId)
  );
  const listed = await peopleManager.automationRules.list({ params: { workspace } });
  const rule = listed.find(candidate => candidate.id === created.id);

  expect(rule).toBeDefined();
  expect(JSON.stringify(rule)).not.toContain('secret-condition');
  expect(JSON.stringify(rule)).not.toContain('secret audit note');
  expect(JSON.stringify(rule)).not.toContain('secret notification message');
  expect(JSON.stringify(rule)).not.toContain('secret-action');
  expect(rule).toMatchObject({
    name: 'Restricted automation rule',
    description: 'Visible rule description',
    conditions: [{ field: 'pii_scope', value: '[redacted]' }],
    actions: [
      { kind: 'create_audit_note', note: '[redacted]' },
      { kind: 'send_notification', message: '[redacted]' },
      { kind: 'set_field_value', field: 'pii_scope', value: '[redacted]' }
    ]
  });
});

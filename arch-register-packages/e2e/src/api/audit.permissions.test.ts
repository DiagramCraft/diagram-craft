import { randomUUID } from 'node:crypto';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { createTestORPCClient } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';
import type { TestORPCClient } from '../helpers/orpcTestClient';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';

const test = createPermissionApiTest().extend<{
  relationAutomationNote: { noteId: string; auditViewer: TestORPCClient };
}>({
  relationAutomationNote: [
    async ({ server, resources }, use) => {
      const now = new Date('2026-08-05T12:00:00.000Z');
      const endpointSchemaId = randomUUID();
      const relationSchemaId = randomUUID();
      const restrictedGroupId = randomUUID();
      const inEntityId = randomUUID();
      const outEntityId = randomUUID();
      const relationId = randomUUID();

      const auditViewerId = randomUUID();
      await createFixtureUser(server.db, {
        id: auditViewerId,
        user_id: 'audit-viewer',
        email: 'audit-viewer@e2e.test',
        display_name: 'Audit Viewer',
        password_hash: null,
        is_active: true,
        created_at: now,
        updated_at: now
      });
      const auditViewerRoleId = randomUUID();
      await server.db.workspace.createCustomWorkspaceRole({
        id: auditViewerRoleId,
        workspace: resources.workspaceId,
        name: 'Audit viewer',
        description: '',
        tone: '',
        builtin: false,
        capabilities: ['ws.view', 'ws.audit'],
        created_at: now,
        updated_at: now
      });
      await server.db.workspace.setWorkspaceMemberRole(
        resources.workspaceId,
        auditViewerId,
        auditViewerRoleId,
        now
      );

      await server.db.catalog.createSchema({
        id: endpointSchemaId,
        workspace: resources.workspaceId,
        name: 'Audit note endpoint schema',
        description: '',
        fields: [
          {
            id: 'incoming_relation',
            name: 'Incoming relation',
            type: 'typedRelation',
            requirementLevel: null,
            relationSchemaId,
            direction: 'in',
            groupId: restrictedGroupId
          },
          {
            id: 'outgoing_relation',
            name: 'Outgoing relation',
            type: 'typedRelation',
            requirementLevel: null,
            relationSchemaId,
            direction: 'out',
            groupId: restrictedGroupId
          }
        ],
        templates: [],
        groups: [
          {
            id: restrictedGroupId,
            name: 'Restricted relation endpoint',
            accessControl: { teamIds: [resources.teamIds.security] }
          }
        ],
        shared_field_group_links: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: `AN${randomUUID().replaceAll('-', '').slice(0, 3).toUpperCase()}`,
        created_at: now,
        updated_at: now
      });

      await server.db.relation.createRelationSchema({
        id: relationSchemaId,
        workspace: resources.workspaceId,
        name: 'Audit note relation',
        description: '',
        in_schema_ids: [endpointSchemaId],
        out_schema_ids: [endpointSchemaId],
        fields: [],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      });

      for (const [id, name, slug] of [
        [inEntityId, 'Restricted Audit Source', 'restricted-audit-source'],
        [outEntityId, 'Restricted Audit Target', 'restricted-audit-target']
      ] as const) {
        await server.db.catalog.createEntity({
          id,
          workspace: resources.workspaceId,
          public_id: `AN-${randomUUID().slice(0, 8)}`,
          slug,
          namespace: 'default',
          name,
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
      }

      await server.db.relation.createRelation({
        id: relationId,
        workspace: resources.workspaceId,
        schema_id: relationSchemaId,
        in_entity_id: inEntityId,
        out_entity_id: outEntityId,
        data: {},
        created_at: now,
        updated_at: now
      });

      const note = await server.db.audit.createAuditLog({
        workspace: resources.workspaceId,
        timestamp: new Date(now.getTime() + 1),
        user_id: null,
        operation: 'create',
        entity_type: 'automation_note',
        entity_id: relationId,
        entity_name: 'Restricted Audit Source → Restricted Audit Target',
        entity_slug: null,
        schema_id: relationSchemaId,
        changes: { new: { note: 'Review this relation' } },
        metadata: {
          resourceType: 'relation',
          relation: {
            id: relationId,
            schema: { id: relationSchemaId, name: 'Audit note relation' },
            in: { id: inEntityId, name: 'Restricted Audit Source' },
            out: { id: outEntityId, name: 'Restricted Audit Target' }
          }
        }
      });

      await use({
        noteId: note.id,
        auditViewer: createTestORPCClient(
          server.baseUrl,
          await makeAuthHeader(server.db, auditViewerId)
        )
      });
    },
    { scope: 'file' }
  ]
});

test('hides relation automation-note context from users without endpoint access', async ({
  personas,
  relationAutomationNote
}) => {
  const viewerLogs = await relationAutomationNote.auditViewer.audit.list({
    params: { workspace: 'default' },
    query: { entityType: 'automation_note' }
  });
  expect(viewerLogs.some(log => log.id === relationAutomationNote.noteId)).toBe(false);

  const authorizedLogs = await personas.globalAdmin.orpc.audit.list({
    params: { workspace: 'default' },
    query: { entityType: 'automation_note' }
  });
  expect(authorizedLogs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          relation: expect.objectContaining({
            in: expect.objectContaining({ name: 'Restricted Audit Source' }),
            out: expect.objectContaining({ name: 'Restricted Audit Target' })
          })
        })
      })
    ])
  );
});

import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createPermissionApiTest();

const PII_GROUP_ID = '00000000-0000-0000-0000-f00000000001';
const COMPONENT_SCHEMA_ID = '00000000-0000-0000-0000-000000000003';
const RESTRICTED_VIEW_ID = '00000000-0000-0000-0020-000000000099';
const RESTRICTED_CONFIG_VIEW_ID = '00000000-0000-0000-0020-000000000098';

const restrictedViewsTest = test.extend<{ restrictedViews: true }>({
  restrictedViews: [
    async ({ server, resources }, use) => {
      const schema = await server.db.catalog.getSchema(resources.workspaceId, COMPONENT_SCHEMA_ID);
      if (!schema) throw new Error('Expected seeded component schema to exist');

      await server.db.catalog.updateSchema(resources.workspaceId, schema.id, {
        name: schema.name,
        description: schema.description,
        fields: schema.fields,
        templates: schema.templates,
        groups: (schema.groups ?? []).map(group =>
          group.id === PII_GROUP_ID
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
        updated_at: new Date()
      });

      const now = new Date('2026-08-03T00:00:00.000Z');
      await server.db.view.createSavedView({
        id: RESTRICTED_VIEW_ID,
        workspace: resources.workspaceId,
        project_id: null,
        project_scope: null,
        name: 'Restricted Secret View',
        description: 'Contains a restricted literal',
        is_admin_view: false,
        view_mode: 'map',
        filters: {
          schemaId: COMPONENT_SCHEMA_ID,
          root: {
            kind: 'predicate',
            path: [],
            fieldId: 'pii_scope',
            op: 'equals',
            value: 'top-secret'
          }
        },
        config: {
          map: {
            fieldIds: ['pii_scope'],
            levels: 1,
            level1SchemaId: COMPONENT_SCHEMA_ID,
            level1Columns: 1,
            metricConfig: {
              sourceSchemaId: COMPONENT_SCHEMA_ID,
              source: { kind: 'enum', fieldId: 'pii_classification' },
              aggregation: 'count'
            }
          }
        },
        created_at: now,
        updated_at: now
      });
      await server.db.view.createSavedView({
        id: RESTRICTED_CONFIG_VIEW_ID,
        workspace: resources.workspaceId,
        project_id: null,
        project_scope: null,
        name: 'Restricted Configuration View',
        description: 'Contains a restricted literal only in configuration',
        is_admin_view: false,
        view_mode: 'radar',
        filters: { root: { kind: 'and', children: [] } },
        config: {
          radar: {
            schemaId: COMPONENT_SCHEMA_ID,
            quadrantFieldId: '_lifecycle',
            ringFieldId: 'pii_scope',
            ringOrder: ['top-secret']
          }
        },
        created_at: now,
        updated_at: now
      });

      await use(true);
    },
    { scope: 'file' }
  ]
});

const viewData = {
  name: 'E2E Test View',
  description: 'A view created by permission tests',
  viewMode: 'table' as const,
  filters: {
    root: {
      kind: 'predicate' as const,
      path: [],
      fieldId: '_lifecycle',
      op: 'equals' as const,
      value: seedIds.lifecycle.production
    }
  },
  config: null
};

test.describe('saved view permission routes', () => {
  test('authentication: views list returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.views.list({ params: { workspace: 'default' } })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    });
  });

  test('authorization: viewer can list views but cannot create, update, or delete', async ({
    personas
  }) => {
    const views = await personas.workspaceViewer.orpc.views.list({
      params: { workspace: 'default' }
    });
    expect(views.length).toBeGreaterThan(0);

    await expect(
      personas.workspaceViewer.orpc.views.create({
        params: { workspace: 'default' },
        body: viewData
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      personas.workspaceViewer.orpc.views.update({
        params: { workspace: 'default', id: views[0]!.id },
        body: { name: 'Should not be allowed' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      personas.workspaceViewer.orpc.views.remove({
        params: { workspace: 'default', id: views[0]!.id }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('authorization: project editor can manage project-scoped views for accessible projects', async ({
    personas,
    resources
  }) => {
    const project = await personas.designTeamAdmin.orpc.projects.create({
      params: { workspace: 'default' },
      body: {
        name: 'Design Team View Project',
        owner: resources.teamIds.design
      }
    });

    const created = await personas.designTeamAdmin.orpc.views.create({
      params: { workspace: 'default' },
      body: {
        ...viewData,
        scope: 'project',
        projectId: project.id,
        projectScope: 'project'
      }
    });

    expect(created.scope).toBe('project');

    const listed = await personas.designTeamAdmin.orpc.views.list({
      params: { workspace: 'default' },
      query: {
        projectId: project.id,
        includeWorkspace: true
      }
    });
    expect(listed.some(view => view.id === created.id)).toBe(true);

    const updated = await personas.designTeamAdmin.orpc.views.update({
      params: { workspace: 'default', id: created.id },
      body: { name: 'Project Scoped View Updated', projectScope: 'all' }
    });
    expect(updated.name).toBe('Project Scoped View Updated');
    expect(updated.projectScope).toBe('all');

    await expect(
      personas.designTeamAdmin.orpc.views.remove({
        params: { workspace: 'default', id: created.id }
      })
    ).resolves.toMatchObject({ success: true });
  });

  test('authorization: users without project access cannot list project-scoped views', async ({
    personas,
    resources
  }) => {
    const project = await personas.designTeamAdmin.orpc.projects.create({
      params: { workspace: 'default' },
      body: {
        name: 'Hidden View Project',
        owner: resources.teamIds.design
      }
    });

    await expect(
      personas.workspaceViewer.orpc.views.list({
        params: { workspace: 'default' },
        query: {
          projectId: project.id,
          includeWorkspace: true
        }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('authorization: outsider cannot access views at all', async ({ personas }) => {
    await expect(
      personas.outsider.orpc.views.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

restrictedViewsTest.describe('saved view restricted-field disclosure', () => {
  restrictedViewsTest(
    'viewer cannot list a view containing restricted literals',
    async ({ personas, restrictedViews: _ }) => {
      const views = await personas.workspaceViewer.orpc.views.list({
        params: { workspace: 'default' }
      });
      expect(views.some(view => view.id === RESTRICTED_VIEW_ID)).toBe(false);
      expect(views.some(view => view.id === RESTRICTED_CONFIG_VIEW_ID)).toBe(false);
      expect(JSON.stringify(views)).not.toContain('top-secret');
      expect(JSON.stringify(views)).not.toContain('pii_classification');

      const adminViews = await personas.globalAdmin.orpc.views.list({
        params: { workspace: 'default' }
      });
      expect(adminViews.find(view => view.id === RESTRICTED_VIEW_ID)).toMatchObject({
        filters: { root: { value: 'top-secret' } }
      });
      expect(adminViews.find(view => view.id === RESTRICTED_CONFIG_VIEW_ID)).toMatchObject({
        config: { radar: { ringOrder: ['top-secret'] } }
      });
    }
  );

  restrictedViewsTest(
    'view managers cannot create or update definitions using restricted fields',
    async ({ personas, restrictedViews: _ }) => {
      const restrictedFilters = {
        root: {
          kind: 'predicate' as const,
          path: [],
          fieldId: 'pii_scope',
          op: 'equals' as const,
          value: 'top-secret'
        }
      };

      await expect(
        personas.workspaceEditor.orpc.views.create({
          params: { workspace: 'default' },
          body: {
            name: 'Should Be Forbidden',
            viewMode: 'table',
            filters: restrictedFilters
          }
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const safeView = await personas.workspaceEditor.orpc.views.create({
        params: { workspace: 'default' },
        body: {
          name: 'Safe View For Update Test',
          viewMode: 'table',
          filters: { root: { kind: 'and', children: [] } }
        }
      });

      await expect(
        personas.workspaceEditor.orpc.views.update({
          params: { workspace: 'default', id: safeView.id },
          body: { filters: restrictedFilters }
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const stored = await personas.globalAdmin.orpc.views.list({
        params: { workspace: 'default' }
      });
      expect(stored.find(view => view.id === safeView.id)?.filters).toEqual({
        root: { kind: 'and', children: [] }
      });
    }
  );
});

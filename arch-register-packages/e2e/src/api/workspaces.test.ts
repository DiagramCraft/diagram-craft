import { test, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';
import { NONEXISTENT_UUID } from '../helpers/testIds';

test.describe('workspace routes', () => {
  test('GET /api/workspaces returns seeded workspaces', async ({ orpc }) => {
    const workspaces = await orpc.workspaces.list(undefined);
    expect(workspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: seedIds.workspace.default,
          name: 'Default Workspace',
          url_slug: 'default',
          short_code: 'DW',
          created_at: expect.any(String),
          updated_at: expect.any(String)
        })
      ])
    );
  });

  test('GET /api/workspaces/templates returns available workspace templates', async ({ orpc }) => {
    const templates = await orpc.workspaces.templates(undefined);
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        category: expect.stringMatching(/^(full|cross-cutting)$/),
        entity_types: expect.any(Array)
      })
    );
    expect(
      templates.filter(template => template.category === 'cross-cutting').map(t => t.id)
    ).toEqual(expect.arrayContaining(['glossary', 'security', 'risk-compliance']));
  });

  test('GET /api/workspaces returns 401 without token', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.workspaces.list(undefined)).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    });
  });

  test('POST /api/workspaces creates a workspace with default settings', async ({
    server,
    orpc
  }) => {
    const created = await orpc.workspaces.create({ body: { name: 'Platform Strategy' } });
    expect(created).toMatchObject({
      id: expect.any(String),
      name: 'Platform Strategy',
      url_slug: 'platform-strategy',
      short_code: 'PS'
    });

    const lifecycleStates = await server.db.workspace.listLifecycleStates(created.id);
    expect(lifecycleStates.map(state => state.label)).toEqual([
      'Proposed',
      'Experimental',
      'Production',
      'Deprecated'
    ]);

    const teams = await server.db.workspace.listTeams(created.id);
    expect(teams.map(team => team.name)).toEqual(['Platform Team', 'UX Team', 'Security Team']);
  });

  test('POST /api/workspaces materializes template enums and document types', async ({
    server,
    orpc
  }) => {
    const created = await orpc.workspaces.create({
      body: { name: 'Security Template Workspace', template: 'security' }
    });

    const [schemas, enums, documentTypes, documentTemplates] = await Promise.all([
      server.db.catalog.listSchemas(created.id),
      server.db.catalog.listEnums(created.id),
      server.db.document.listDocumentTypes(created.id),
      server.db.document.listDocumentTemplates(created.id)
    ]);
    const enumIds = new Set(enums.map(enumeration => enumeration.id));
    const selectFields = schemas.flatMap(schema =>
      schema.fields.filter(field => field.type === 'select')
    );

    expect(enums).toHaveLength(6);
    expect(enums.every(enumeration => enumeration.options.length > 0)).toBe(true);
    expect(selectFields.every(field => enumIds.has(field.enumId))).toBe(true);
    expect(documentTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Architecture Decision Record', archived: false })
      ])
    );
    const adrType = documentTypes.find(type => type.name === 'Architecture Decision Record');
    expect(documentTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Architecture Decision Record',
          document_type_id: adrType?.id
        })
      ])
    );
  });

  test('POST /api/workspaces materializes template capability configurations', async ({
    server,
    orpc
  }) => {
    const created = await orpc.workspaces.create({
      body: { name: 'Default Capability Template Workspace', template: 'default' }
    });
    const schemas = await server.db.catalog.listSchemas(created.id);
    const api = schemas.find(schema => schema.name === 'API');
    const configuration = await server.db.workspace.getWorkspaceCapabilityConfiguration(
      created.id,
      'api-specification'
    );

    expect(configuration).toMatchObject({
      workspace: created.id,
      type: 'api-specification',
      bindings: { api: { target: { kind: 'entity_schema', id: api?.id } } }
    });
  });

  test('POST /api/workspaces composes a full template with cross-cutting concerns', async ({
    server,
    orpc
  }) => {
    const created = await orpc.workspaces.create({
      body: {
        name: 'Composed Architecture Workspace',
        template: 'default',
        cross_cutting_templates: ['glossary', 'security', 'risk-compliance']
      }
    });
    const schemas = await server.db.catalog.listSchemas(created.id);

    expect(schemas.map(schema => schema.name)).toEqual(
      expect.arrayContaining([
        'Term',
        'Risk',
        'Control',
        'Risk & Compliance — Risk',
        'Risk & Compliance — Control'
      ])
    );
    const dashboards = await orpc.dashboard.list({ params: { workspace: created.url_slug } });
    expect(dashboards.map(dashboard => dashboard.name)).toEqual(['Overview', 'Risk & Compliance']);
  });

  test('POST /api/workspaces adds concerns to an otherwise blank workspace', async ({
    server,
    orpc
  }) => {
    const created = await orpc.workspaces.create({
      body: { name: 'Blank With Glossary', cross_cutting_templates: ['glossary'] }
    });
    const schemas = await server.db.catalog.listSchemas(created.id);
    expect(schemas.map(schema => schema.name)).toEqual(
      expect.arrayContaining(['Term', 'Term Category'])
    );
  });

  test('POST /api/workspaces applies a template dashboard layout', async ({ server, orpc }) => {
    const created = await orpc.workspaces.create({
      body: { name: 'Risk Dashboard Workspace', template: 'risk-compliance' }
    });

    const [dashboards, schemas] = await Promise.all([
      orpc.dashboard.list({ params: { workspace: created.url_slug } }),
      server.db.catalog.listSchemas(created.id)
    ]);
    const risk = schemas.find(schema => schema.name === 'Risk');
    const complianceRequirement = schemas.find(schema => schema.name === 'Compliance Requirement');

    expect(dashboards).toHaveLength(2);
    expect(dashboards.find(dashboard => dashboard.name === 'Overview')!.widgets).toHaveLength(0);
    const riskDashboard = dashboards.find(dashboard => dashboard.name === 'Risk & Compliance')!;
    expect(riskDashboard.widgets).toHaveLength(8);
    expect(riskDashboard.widgets).toContainEqual(
      expect.objectContaining({
        id: 'top-risks-by-score',
        config: expect.objectContaining({ schema: risk?.id })
      })
    );
    expect(riskDashboard.widgets).toContainEqual(
      expect.objectContaining({
        id: 'compliance-coverage',
        config: expect.objectContaining({ schema: complianceRequirement?.id })
      })
    );
  });

  test('POST /api/workspaces applies slug and badge overrides', async ({ orpc }) => {
    const created = await orpc.workspaces.create({
      body: {
        name: 'Architecture Governance',
        slug: 'arch gov',
        badge: 'agx',
        color: '#112233',
        description: 'Workspace description'
      }
    });
    expect(created).toMatchObject({
      id: expect.any(String),
      name: 'Architecture Governance',
      url_slug: 'arch-gov',
      short_code: 'AGX',
      color: '#112233',
      description: 'Workspace description'
    });
  });

  test('POST /api/workspaces returns 400 for a non-object request body', async ({ orpc }) => {
    await expect(
      orpc.workspaces.create({ body: { name: undefined as unknown as string } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('POST /api/workspaces returns 409 for a duplicate workspace name', async ({ orpc }) => {
    await expect(
      orpc.workspaces.create({ body: { name: 'Default Workspace' } })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A workspace with that name already exists'
    });
  });

  test('PUT /api/workspaces/:id updates a workspace and preserves omitted fields', async ({
    orpc
  }) => {
    const created = await orpc.workspaces.create({
      body: { name: 'Workspace To Rename', color: '#123456', description: 'Original description' }
    });

    const updated = await orpc.workspaces.update({
      params: { workspace: created.id },
      body: { name: 'Workspace Renamed' }
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Workspace Renamed',
      url_slug: 'workspace-to-rename',
      color: '#123456',
      description: 'Original description'
    });
  });

  test('PUT /api/workspaces/:id replaces explicit mutable fields', async ({ orpc }) => {
    const created = await orpc.workspaces.create({ body: { name: 'Workspace Settings' } });

    const updated = await orpc.workspaces.update({
      params: { workspace: created.id },
      body: {
        name: 'Workspace Settings Updated',
        url_slug: 'ws settings updated',
        short_code: 'WU',
        color: '#abcdef',
        description: 'Updated description'
      }
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Workspace Settings Updated',
      url_slug: 'ws-settings-updated',
      short_code: 'WU',
      color: '#abcdef',
      description: 'Updated description'
    });
  });

  test('PUT /api/workspaces/:id returns 404 for an unknown workspace id', async ({ orpc }) => {
    await expect(
      orpc.workspaces.update({ params: { workspace: NONEXISTENT_UUID }, body: { name: 'Nope' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('DELETE /api/workspaces/:id deletes a workspace', async ({ orpc }) => {
    const created = await orpc.workspaces.create({ body: { name: 'Workspace To Delete' } });

    const result = await orpc.workspaces.remove({ params: { workspace: created.id } });
    expect(result).toMatchObject({
      success: true,
      message: "Workspace 'Workspace To Delete' deleted"
    });
  });

  test('DELETE /api/workspaces/:id returns 404 for an unknown workspace id', async ({ orpc }) => {
    await expect(
      orpc.workspaces.remove({ params: { workspace: NONEXISTENT_UUID } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

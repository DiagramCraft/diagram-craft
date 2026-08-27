import { test, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';
import { NONEXISTENT_UUID } from '../helpers/testIds';
import { SCHEMA_TEMPLATES } from '@arch-register/server/domain/catalog/schemaTemplates';

const templateObjectCount = (template: (typeof SCHEMA_TEMPLATES)[number]) =>
  template.schemas.length +
  template.enums.length +
  (template.relationSchemas?.length ?? 0) +
  (template.fieldGroups?.length ?? 0);

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
        template_object_count: expect.any(Number),
        entity_types: expect.any(Array)
      })
    );
    expect(templates).toHaveLength(SCHEMA_TEMPLATES.length);
    for (const sourceTemplate of SCHEMA_TEMPLATES) {
      expect(templates.find(template => template.id === sourceTemplate.id)).toEqual(
        expect.objectContaining({ template_object_count: templateObjectCount(sourceTemplate) })
      );
    }
    expect(templates.find(template => template.id === 'default')?.template_object_count).toBe(19);
    expect(
      templates.find(template => template.id === 'information-governance')?.template_object_count
    ).toBe(12);
    expect(
      templates.filter(template => template.category === 'cross-cutting').map(t => t.id)
    ).toEqual(
      expect.arrayContaining(['glossary', 'information-governance', 'security', 'risk-compliance'])
    );
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

  test('POST /api/workspaces resolves cross-cutting template dependencies atomically', async ({
    server,
    orpc
  }) => {
    const missingMappingName = 'Unresolved Data Flow Workspace';
    await expect(
      orpc.workspaces.create({
        body: {
          name: missingMappingName,
          template: 'default',
          cross_cutting_templates: ['information-governance']
        }
      })
    ).rejects.toBeDefined();
    expect(
      (await server.db.workspace.listWorkspaces()).some(ws => ws.name === missingMappingName)
    ).toBe(false);

    const created = await orpc.workspaces.create({
      body: {
        name: 'Mapped Data Flow Workspace',
        template: 'default',
        cross_cutting_templates: ['information-governance'],
        template_dependency_mappings: [
          {
            dependency_id: 'information-governance:data-flow:system',
            targets: [
              { template_id: 'default', sym_id: 'system' },
              { template_id: 'default', sym_id: 'component' }
            ]
          }
        ]
      }
    });
    const [schemas, relationSchemas] = await Promise.all([
      server.db.catalog.listSchemas(created.id),
      server.db.relation.listRelationSchemas(created.id)
    ]);
    const dataFlow = relationSchemas.find(schema => schema.name === 'Data Flow')!;
    const system = schemas.find(schema => schema.name === 'System')!;
    const component = schemas.find(schema => schema.name === 'Component')!;
    expect(dataFlow.in_schema_ids).toEqual(expect.arrayContaining([system.id, component.id]));
    expect(dataFlow.out_schema_ids).toEqual(expect.arrayContaining([system.id, component.id]));
    for (const schema of [system, component]) {
      expect(schema.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'data_flows_out', relationSchemaId: dataFlow.id }),
          expect.objectContaining({ id: 'data_flows_in', relationSchemaId: dataFlow.id })
        ])
      );
    }
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

  test('POST /api/workspaces materializes information governance stewardship metadata', async ({
    server,
    orpc
  }) => {
    const created = await orpc.workspaces.create({
      body: {
        name: 'Information Governance Workspace',
        cross_cutting_templates: ['information-governance']
      }
    });

    const [schemas, enums, fieldGroups] = await Promise.all([
      server.db.catalog.listSchemas(created.id),
      server.db.catalog.listEnums(created.id),
      server.db.catalog.listSharedFieldGroups(created.id)
    ]);
    const dataEntity = schemas.find(schema => schema.name === 'Data Entity');
    const stewardshipGroup = fieldGroups.find(
      fieldGroup => fieldGroup.name === 'Information Asset Stewardship'
    );

    expect(dataEntity).toBeDefined();
    expect(dataEntity?.fields).toEqual([
      expect.objectContaining({ id: 'classification', type: 'select' })
    ]);
    expect(dataEntity?.shared_field_group_links).toEqual([
      expect.objectContaining({ groupId: stewardshipGroup?.id })
    ]);
    expect(stewardshipGroup?.fields.map(field => field.id)).toEqual([
      'steward',
      'custodian',
      'review_date',
      'regulatory_tags',
      'processing_purposes',
      'permitted_residency_regions'
    ]);
    expect(enums.map(enumeration => enumeration.name)).toEqual(
      expect.arrayContaining([
        'Regulatory Tags',
        'Processing Purposes',
        'Residency Regions',
        'Retention Time Unit',
        'PII Classification'
      ])
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

  test('POST /api/workspaces seeds saved views from a cross-cutting template', async ({
    server,
    orpc
  }) => {
    const created = await orpc.workspaces.create({
      body: { name: 'Strategy Views Workspace', template: 'strategy' }
    });

    const [views, schemas] = await Promise.all([
      server.db.view.listSavedViews(created.id),
      server.db.catalog.listSchemas(created.id)
    ]);
    const strategyConfiguration = await server.db.workspace.getWorkspaceCapabilityConfiguration(
      created.id,
      'strategy-model'
    );
    const businessCapability = schemas.find(schema => schema.name === 'Business Capability');
    const objective = schemas.find(schema => schema.name === 'Objective');
    const initiative = schemas.find(schema => schema.name === 'Initiative');

    expect(views.map(view => view.name)).toEqual(
      expect.arrayContaining(['Objectives', 'Initiatives'])
    );
    expect(businessCapability?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'parent',
          type: 'containment',
          schemaId: businessCapability?.id,
          minCount: 0,
          maxCount: 1
        })
      ])
    );
    expect(strategyConfiguration?.bindings.business_capability).toEqual({
      target: { kind: 'entity_schema', id: businessCapability?.id }
    });
    const objectivesView = views.find(view => view.name === 'Objectives');
    expect(objectivesView).toMatchObject({
      workspace: created.id,
      project_id: null,
      view_mode: 'table',
      filters: expect.objectContaining({ schemaId: objective?.id }),
      config: { table: { fieldIds: ['status', 'target_date'] } }
    });
    const initiativesView = views.find(view => view.name === 'Initiatives');
    expect(initiativesView).toMatchObject({
      filters: expect.objectContaining({ schemaId: initiative?.id })
    });
  });

  test('supports nested Business Capability containment in a Strategy workspace', async ({
    orpc,
    server
  }) => {
    const created = await orpc.workspaces.create({
      body: { name: 'Nested Business Capabilities', template: 'strategy' }
    });
    const schemas = await server.db.catalog.listSchemas(created.id);
    const businessCapability = schemas.find(schema => schema.name === 'Business Capability')!;

    const root = await orpc.entities.create({
      params: { workspace: created.url_slug },
      body: { _schemaId: businessCapability.id, _name: 'Customer Engagement' }
    });
    const child = await orpc.entities.create({
      params: { workspace: created.url_slug },
      body: {
        _schemaId: businessCapability.id,
        _name: 'Customer Self Service',
        parent: [root._uid]
      }
    });
    const grandchild = await orpc.entities.create({
      params: { workspace: created.url_slug },
      body: {
        _schemaId: businessCapability.id,
        _name: 'Account Management',
        parent: [child._uid]
      }
    });

    const [rootStored, childStored, grandchildStored] = await Promise.all([
      server.db.catalog.getEntity(created.id, root._uid),
      server.db.catalog.getEntity(created.id, child._uid),
      server.db.catalog.getEntity(created.id, grandchild._uid)
    ]);
    expect(rootStored?.data.capability_level).toBe('L1');
    expect(childStored?.data.capability_level).toBe('L2');
    expect(grandchildStored?.data.capability_level).toBe('L3');

    const tree = await orpc.entities.tree({
      params: { workspace: created.url_slug },
      query: { _schemaId: businessCapability.id, q: 'Account Management' }
    });

    expect(tree.nodes.map(node => node._uid)).toEqual(
      expect.arrayContaining([root._uid, child._uid, grandchild._uid])
    );
    expect(tree.edges).toEqual(
      expect.arrayContaining([
        { childId: child._uid, parentId: root._uid },
        { childId: grandchild._uid, parentId: child._uid }
      ])
    );

    const structuralTree = await orpc.entities.tree({
      params: { workspace: created.url_slug },
      query: {
        _schemaId: businessCapability.id,
        q: 'Customer Engagement',
        treeExpansion: 'both',
        treeDepth: 2
      }
    });

    expect(structuralTree.nodes.map(node => [node._uid, node._isMatch])).toEqual([
      [root._uid, true],
      [child._uid, false],
      [grandchild._uid, false]
    ]);
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

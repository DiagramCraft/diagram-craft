import { randomUUID } from 'node:crypto';
import { test, expect } from '../helpers/fixtures';

test.describe('definition import', () => {
  test('preserves entity and relation schema categories copied from another workspace', async ({
    orpc,
    server
  }) => {
    const suffix = randomUUID();
    const source = await orpc.workspaces.create({
      body: { name: `Categorized definitions source ${suffix}`, badge: 'CIS' }
    });
    const target = await orpc.workspaces.create({
      body: { name: `Categorized definitions target ${suffix}`, badge: 'CIT' }
    });
    const entitySchema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: { name: `Categorized entity ${suffix}`, category: 'Architecture' }
    });
    const relationSchema = await orpc.relationSchemas.create({
      params: { workspace: source.url_slug },
      body: {
        name: `Categorized relation ${suffix}`,
        category: 'Connectivity',
        in: { schemaIds: [entitySchema.id] },
        out: { schemaIds: [entitySchema.id] }
      }
    });

    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'workspace', id: source.url_slug },
        selection: {
          schemas: [entitySchema.id],
          enums: [],
          documentTypes: [],
          relationSchemas: [relationSchema.id],
          fieldGroups: [],
          dashboard: false
        }
      }
    });
    expect(preview.errors).toEqual([]);

    await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        schemas: preview.schemas,
        enums: preview.enums,
        documentTypes: preview.documentTypes,
        relationSchemas: preview.relationSchemas,
        fieldGroups: preview.fieldGroups,
        dashboardWidgets: preview.dashboardWidgets,
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });

    expect(
      (await server.db.catalog.listSchemas(target.id)).find(
        schema => schema.name === entitySchema.name
      )?.category
    ).toBe('Architecture');
    expect(
      (await server.db.relation.listRelationSchemas(target.id)).find(
        schema => schema.name === relationSchema.name
      )?.category
    ).toBe('Connectivity');
  });

  test('previews and imports selected built-in definitions with dependencies', async ({
    orpc,
    server
  }) => {
    const target = await orpc.workspaces.create({ body: { name: 'Definition Import Target' } });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(source => source.kind === 'builtin');
    expect(builtin).toBeDefined();
    expect(builtin!.schemas.length).toBeGreaterThan(0);

    const selectedSchema = builtin!.schemas[0]!;
    const selectedDocumentType = builtin!.documentTypes[0];
    const selection = {
      schemas: [selectedSchema.id],
      enums: [],
      documentTypes: selectedDocumentType ? [selectedDocumentType.id] : [],
      relationSchemas: [],
      fieldGroups: [],
      dashboard: false
    };
    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: { source: { kind: 'builtin', id: builtin!.id }, selection }
    });

    expect(preview.errors).toEqual([]);
    expect(preview.schemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: selectedSchema.id, dependency: false })
      ])
    );
    expect(preview.schemas.length).toBeGreaterThanOrEqual(1);

    const result = await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        schemas: preview.schemas,
        enums: preview.enums,
        documentTypes: preview.documentTypes,
        relationSchemas: preview.relationSchemas,
        fieldGroups: preview.fieldGroups,
        dashboardWidgets: preview.dashboardWidgets,
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });

    expect(result).toEqual({
      schemas: preview.schemas.length,
      enums: preview.enums.length,
      documentTypes: preview.documentTypes.length,
      relationSchemas: preview.relationSchemas.length,
      fieldGroups: preview.fieldGroups.length,
      dashboardWidgets: preview.dashboardWidgets.length,
      updatedSchemas: preview.schemaPatches.length
    });

    const [schemas, enums, documentTypes] = await Promise.all([
      server.db.catalog.listSchemas(target.id),
      server.db.catalog.listEnums(target.id),
      server.db.document.listDocumentTypes(target.id)
    ]);
    expect(schemas).toHaveLength(preview.schemas.length);
    expect(enums).toHaveLength(preview.enums.length);
    expect(documentTypes).toHaveLength(preview.documentTypes.length);
    expect(schemas.every(schema => schema.id !== selectedSchema.id)).toBe(true);
    const schemaIds = new Set(schemas.map(schema => schema.id));
    const enumIds = new Set(enums.map(enumeration => enumeration.id));
    for (const schema of schemas) {
      for (const field of schema.fields) {
        if (field.type === 'reference' || field.type === 'containment') {
          expect(schemaIds.has(field.schemaId)).toBe(true);
        }
        if (field.type === 'select') expect(enumIds.has(field.enumId)).toBe(true);
      }
    }
  });

  test('blocks a case-insensitive name collision before persistence', async ({ orpc, server }) => {
    const target = await orpc.workspaces.create({ body: { name: 'Definition Collision Target' } });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(source => source.kind === 'builtin')!;
    const selectedSchema = builtin.schemas[0]!;
    await orpc.schemas.create({
      params: { workspace: target.url_slug },
      body: { name: selectedSchema.name.toUpperCase(), key_prefix: 'COLL', fields: [] }
    });

    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'builtin', id: builtin.id },
        selection: {
          schemas: [selectedSchema.id],
          enums: [],
          documentTypes: [],
          relationSchemas: [],
          fieldGroups: [],
          dashboard: false
        }
      }
    });
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'schema', name: selectedSchema.name })
      ])
    );

    await expect(
      orpc.workspaces.definitionImportExecute({
        params: { workspace: target.url_slug },
        body: {
          source: preview.source,
          selection: preview.selection,
          schemas: preview.schemas,
          enums: preview.enums,
          documentTypes: preview.documentTypes,
          relationSchemas: preview.relationSchemas,
          fieldGroups: preview.fieldGroups,
          dashboardWidgets: preview.dashboardWidgets,
          keyPrefixRemaps: preview.keyPrefixRemaps,
          fingerprint: preview.fingerprint,
          confirmed: true
        }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const renamedPreview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        renames: [{ kind: 'schema', id: selectedSchema.id, name: 'Imported Domain' }]
      }
    });
    expect(renamedPreview.conflicts).toEqual([]);
    expect(renamedPreview.schemas[0]).toMatchObject({
      name: 'Imported Domain',
      definition: { name: 'Imported Domain' }
    });
    await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: renamedPreview.source,
        selection: renamedPreview.selection,
        renames: renamedPreview.renames,
        schemas: renamedPreview.schemas,
        enums: renamedPreview.enums,
        documentTypes: renamedPreview.documentTypes,
        relationSchemas: renamedPreview.relationSchemas,
        fieldGroups: renamedPreview.fieldGroups,
        dashboardWidgets: renamedPreview.dashboardWidgets,
        keyPrefixRemaps: renamedPreview.keyPrefixRemaps,
        fingerprint: renamedPreview.fingerprint,
        confirmed: true
      }
    });

    const importedSchemas = await server.db.catalog.listSchemas(target.id);
    expect(importedSchemas).toHaveLength(renamedPreview.schemas.length + 1);
    expect(importedSchemas.map(schema => schema.name)).toContain('Imported Domain');
  });

  test('imports a built-in API capability with its API schema binding', async ({
    orpc,
    server
  }) => {
    const target = await orpc.workspaces.create({ body: { name: 'API Capability Import Target' } });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(source => source.kind === 'builtin' && source.id === 'default')!;
    const apiSchema = builtin.schemas.find(schema => schema.name === 'API')!;
    const selection = {
      schemas: [apiSchema.id],
      enums: [],
      documentTypes: [],
      relationSchemas: [],
      fieldGroups: [],
      dashboard: false
    };

    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: { source: { kind: 'builtin', id: builtin.id }, selection }
    });

    await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        schemas: preview.schemas,
        enums: preview.enums,
        documentTypes: preview.documentTypes,
        relationSchemas: preview.relationSchemas,
        fieldGroups: preview.fieldGroups,
        dashboardWidgets: preview.dashboardWidgets,
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });

    const importedApi = (await server.db.catalog.listSchemas(target.id)).find(
      schema => schema.name === 'API'
    );
    const configurations = await server.db.workspace.listWorkspaceCapabilityConfigurations(
      target.id
    );
    expect(configurations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'api-specification',
          bindings: {
            api: { target: { kind: 'entity_schema', id: importedApi?.id } }
          }
        })
      ])
    );
  });

  test('imports a relation schema and field group with their dependencies', async ({
    orpc,
    server
  }) => {
    const target = await orpc.workspaces.create({ body: { name: 'Relation Import Target' } });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(source => source.kind === 'builtin' && source.id === 'default')!;
    expect(builtin).toBeDefined();

    const relationSchema = builtin.relationSchemas.find(
      schema => schema.name === 'System Contract'
    )!;
    const fieldGroup = builtin.fieldGroups.find(group => group.name === 'PII Classification')!;
    expect(relationSchema).toBeDefined();
    expect(fieldGroup).toBeDefined();

    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'builtin', id: builtin.id },
        selection: {
          schemas: [],
          enums: [],
          documentTypes: [],
          relationSchemas: [relationSchema.id],
          fieldGroups: [fieldGroup.id],
          dashboard: false
        }
      }
    });

    expect(preview.errors).toEqual([]);
    expect(preview.conflicts).toEqual([]);
    expect(preview.relationSchemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: relationSchema.id, dependency: false })
      ])
    );
    expect(preview.fieldGroups).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: fieldGroup.id, dependency: false })])
    );
    // The relation schema's "in"/"out" endpoints (system, contract) must be pulled in as
    // dependency schemas, and its 'select' field's enum (contract-purpose) as a dependency enum.
    // Typed-relation fields on those schemas may pull in additional relation-schema dependencies.
    const dependencySchemaNames = preview.schemas
      .filter(schema => schema.dependency)
      .map(schema => schema.name);
    expect(dependencySchemaNames).toEqual(expect.arrayContaining(['System', 'Contract']));
    expect(preview.enums.some(enumeration => enumeration.dependency)).toBe(true);

    const result = await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        schemas: preview.schemas,
        enums: preview.enums,
        documentTypes: preview.documentTypes,
        relationSchemas: preview.relationSchemas,
        fieldGroups: preview.fieldGroups,
        dashboardWidgets: preview.dashboardWidgets,
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });

    expect(result).toEqual({
      schemas: preview.schemas.length,
      enums: preview.enums.length,
      documentTypes: preview.documentTypes.length,
      relationSchemas: preview.relationSchemas.length,
      fieldGroups: 1,
      dashboardWidgets: preview.dashboardWidgets.length,
      updatedSchemas: preview.schemaPatches.length
    });

    const [createdSchemas, createdEnums, createdRelationSchemas, createdFieldGroups] =
      await Promise.all([
        server.db.catalog.listSchemas(target.id),
        server.db.catalog.listEnums(target.id),
        server.db.relation.listRelationSchemas(target.id),
        server.db.catalog.listSharedFieldGroups(target.id)
      ]);

    expect(createdRelationSchemas).toHaveLength(preview.relationSchemas.length);
    expect(createdFieldGroups).toHaveLength(1);
    expect(createdFieldGroups[0]!.name).toBe('PII Classification');

    const createdRelationSchema = createdRelationSchemas.find(
      schema => schema.name === 'System Contract'
    )!;
    expect(createdRelationSchema.name).toBe('System Contract');
    const schemaIds = new Set(createdSchemas.map(schema => schema.id));
    const enumIds = new Set(createdEnums.map(enumeration => enumeration.id));
    for (const schemaId of [
      ...createdRelationSchema.in_schema_ids,
      ...createdRelationSchema.out_schema_ids
    ]) {
      expect(schemaIds.has(schemaId)).toBe(true);
    }
    for (const field of createdRelationSchema.fields) {
      if (field.type === 'select') expect(enumIds.has(field.enumId)).toBe(true);
    }
  });

  test('imports the risk-compliance relation schema with numeric and derived fields', async ({
    orpc,
    server
  }) => {
    const target = await orpc.workspaces.create({
      body: { name: 'Risk Compliance Import Target' }
    });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(
      source => source.kind === 'builtin' && source.id === 'risk-compliance'
    )!;
    expect(builtin).toBeDefined();
    expect(builtin.category).toBe('cross-cutting');

    const relationSchema = builtin.relationSchemas.find(
      schema => schema.name === 'Risk Mitigation'
    )!;
    expect(relationSchema).toBeDefined();

    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'builtin', id: builtin.id },
        selection: {
          schemas: [],
          enums: [],
          documentTypes: [],
          relationSchemas: [relationSchema.id],
          fieldGroups: [],
          dashboard: true
        }
      }
    });

    expect(preview.errors).toEqual([]);
    expect(preview.conflicts).toEqual([]);
    expect(preview.dashboardWidgets).toHaveLength(8);
    const dependencySchemaNames = preview.schemas
      .filter(schema => schema.dependency)
      .map(schema => schema.name);
    expect(dependencySchemaNames).toEqual(expect.arrayContaining(['Risk', 'Control']));

    const existingDashboards = await orpc.dashboard.list({
      params: { workspace: target.url_slug }
    });
    await orpc.dashboard.update({
      params: { workspace: target.url_slug, id: existingDashboards[0]!.id },
      body: {
        widgets: [
          {
            id: 'existing-widget',
            type: 'Metric',
            config: { metricType: 'entity-count' },
            x: 0,
            y: 0,
            w: 3,
            h: 2
          }
        ]
      }
    });

    const result = await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        schemas: preview.schemas,
        enums: preview.enums,
        documentTypes: preview.documentTypes,
        relationSchemas: preview.relationSchemas,
        fieldGroups: preview.fieldGroups,
        dashboardWidgets: preview.dashboardWidgets,
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });

    expect(result.relationSchemas).toBe(preview.relationSchemas.length);

    const [createdSchemas, dashboards] = await Promise.all([
      server.db.catalog.listSchemas(target.id),
      orpc.dashboard.list({ params: { workspace: target.url_slug } })
    ]);
    const riskSchema = createdSchemas.find(schema => schema.name === 'Risk');
    expect(riskSchema).toBeDefined();
    expect(riskSchema?.fields).toContainEqual(
      expect.objectContaining({ id: 'likelihood', type: 'number', min: 1, max: 5 })
    );
    expect(riskSchema?.fields).toContainEqual(
      expect.objectContaining({
        id: 'inherent_risk_score',
        type: 'derived',
        expression: 'entity.likelihood * entity.impact',
        resultType: 'number'
      })
    );
    expect(dashboards.find(dashboard => dashboard.name === 'Overview')!.widgets).toContainEqual(
      expect.objectContaining({ id: 'existing-widget' })
    );
    const riskDashboard = dashboards.find(dashboard => dashboard.name === 'Risk & Compliance')!;
    expect(riskDashboard.widgets).toHaveLength(preview.dashboardWidgets.length);
    expect(riskDashboard.widgets).toContainEqual(
      expect.objectContaining({
        id: 'top-risks-by-score',
        config: expect.objectContaining({ schema: riskSchema?.id })
      })
    );
  });

  test('can skip the built-in template dashboard layout', async ({ orpc, server }) => {
    const target = await orpc.workspaces.create({
      body: { name: 'Risk Dashboard Opt-out Target' }
    });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(
      source => source.kind === 'builtin' && source.id === 'risk-compliance'
    )!;
    const relationSchema = builtin.relationSchemas.find(
      schema => schema.name === 'Risk Mitigation'
    )!;
    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'builtin', id: builtin.id },
        selection: {
          schemas: [],
          enums: [],
          documentTypes: [],
          relationSchemas: [relationSchema.id],
          fieldGroups: [],
          dashboard: false
        }
      }
    });

    expect(preview.dashboardWidgets).toEqual([]);
    const result = await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        schemas: preview.schemas,
        enums: preview.enums,
        documentTypes: preview.documentTypes,
        relationSchemas: preview.relationSchemas,
        fieldGroups: preview.fieldGroups,
        dashboardWidgets: preview.dashboardWidgets,
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });

    expect(result.dashboardWidgets).toBe(0);
    expect(await server.db.dashboard.list(target.id)).toEqual([]);
  });

  test('blocks a case-insensitive name collision for a relation schema and field group', async ({
    orpc,
    server
  }) => {
    const target = await orpc.workspaces.create({
      body: { name: 'Relation Collision Target' }
    });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(source => source.kind === 'builtin' && source.id === 'default')!;
    const relationSchema = builtin.relationSchemas.find(
      schema => schema.name === 'System Contract'
    )!;
    const fieldGroup = builtin.fieldGroups.find(group => group.name === 'PII Classification')!;

    // Pre-seed colliding names directly (rather than via a prior import) so the only conflicts
    // are the relation schema / field group themselves, not their pulled-in entity-schema deps.
    const [inSchema, outSchema] = await Promise.all([
      orpc.schemas.create({
        params: { workspace: target.url_slug },
        body: { name: 'Collision In', key_prefix: 'CIN', fields: [] }
      }),
      orpc.schemas.create({
        params: { workspace: target.url_slug },
        body: { name: 'Collision Out', key_prefix: 'COUT', fields: [] }
      })
    ]);
    const now = new Date();
    await server.db.relation.createRelationSchema({
      id: randomUUID(),
      workspace: target.id,
      name: relationSchema.name.toUpperCase(),
      description: '',
      in_schema_ids: [inSchema.id],
      out_schema_ids: [outSchema.id],
      fields: [],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: now,
      updated_at: now
    });
    await orpc.fieldGroups.create({
      params: { workspace: target.url_slug },
      body: { name: fieldGroup.name.toUpperCase(), fields: [] }
    });

    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'builtin', id: builtin.id },
        selection: {
          schemas: [],
          enums: [],
          documentTypes: [],
          relationSchemas: [relationSchema.id],
          fieldGroups: [fieldGroup.id],
          dashboard: false
        }
      }
    });
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'relationSchema', name: 'System Contract' }),
        expect.objectContaining({ kind: 'fieldGroup', name: 'PII Classification' })
      ])
    );

    await expect(
      orpc.workspaces.definitionImportExecute({
        params: { workspace: target.url_slug },
        body: {
          source: preview.source,
          selection: preview.selection,
          schemas: preview.schemas,
          enums: preview.enums,
          documentTypes: preview.documentTypes,
          relationSchemas: preview.relationSchemas,
          fieldGroups: preview.fieldGroups,
          dashboardWidgets: preview.dashboardWidgets,
          keyPrefixRemaps: preview.keyPrefixRemaps,
          fingerprint: preview.fingerprint,
          confirmed: true
        }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const renamedPreview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        renames: [
          { kind: 'relationSchema', id: relationSchema.id, name: 'System Contract (Imported)' },
          { kind: 'fieldGroup', id: fieldGroup.id, name: 'PII Classification (Imported)' }
        ]
      }
    });
    expect(renamedPreview.conflicts).toEqual([]);
    await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: renamedPreview.source,
        selection: renamedPreview.selection,
        renames: renamedPreview.renames,
        schemas: renamedPreview.schemas,
        enums: renamedPreview.enums,
        documentTypes: renamedPreview.documentTypes,
        relationSchemas: renamedPreview.relationSchemas,
        fieldGroups: renamedPreview.fieldGroups,
        dashboardWidgets: renamedPreview.dashboardWidgets,
        keyPrefixRemaps: renamedPreview.keyPrefixRemaps,
        fingerprint: renamedPreview.fingerprint,
        confirmed: true
      }
    });

    const finalRelationSchemas = await server.db.relation.listRelationSchemas(target.id);
    const finalFieldGroups = await server.db.catalog.listSharedFieldGroups(target.id);
    expect(finalRelationSchemas.map(schema => schema.name)).toContain('System Contract (Imported)');
    expect(finalFieldGroups.map(group => group.name)).toContain('PII Classification (Imported)');
  });

  test('imports a standalone field group with no schema selected', async ({ orpc, server }) => {
    const target = await orpc.workspaces.create({
      body: { name: 'Standalone Field Group Target' }
    });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(source => source.kind === 'builtin' && source.id === 'default')!;
    const fieldGroup = builtin.fieldGroups.find(group => group.name === 'PII Classification')!;

    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'builtin', id: builtin.id },
        selection: {
          schemas: [],
          enums: [],
          documentTypes: [],
          relationSchemas: [],
          fieldGroups: [fieldGroup.id],
          dashboard: false
        }
      }
    });
    expect(preview.errors).toEqual([]);
    expect(preview.schemas).toEqual([]);
    expect(preview.relationSchemas).toEqual([]);
    expect(preview.fieldGroups).toEqual([
      expect.objectContaining({ id: fieldGroup.id, dependency: false })
    ]);

    const result = await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        schemas: preview.schemas,
        enums: preview.enums,
        documentTypes: preview.documentTypes,
        relationSchemas: preview.relationSchemas,
        fieldGroups: preview.fieldGroups,
        dashboardWidgets: preview.dashboardWidgets,
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });
    expect(result.fieldGroups).toBe(1);
    expect(result.schemas).toBe(0);

    const [createdSchemas, createdFieldGroups] = await Promise.all([
      server.db.catalog.listSchemas(target.id),
      server.db.catalog.listSharedFieldGroups(target.id)
    ]);
    expect(createdSchemas).toHaveLength(0);
    expect(createdFieldGroups).toHaveLength(1);
    expect(createdFieldGroups[0]!.name).toBe('PII Classification');
  });

  test('maps a cross-cutting Data Flow extension onto existing destination schemas', async ({
    orpc,
    server
  }) => {
    const target = await orpc.workspaces.create({
      body: { name: `Data Flow dependency target ${randomUUID()}`, badge: 'DFT' }
    });
    const system = await orpc.schemas.create({
      params: { workspace: target.url_slug },
      body: { name: 'Imported System', key_prefix: 'ISYS', fields: [] }
    });
    const sources = await orpc.workspaces.definitionImportSources({
      params: { workspace: target.url_slug }
    });
    const builtin = sources.find(
      source => source.kind === 'builtin' && source.id === 'information-governance'
    )!;
    const dataFlow = builtin.relationSchemas.find(schema => schema.name === 'Data Flow')!;
    const selection = {
      schemas: [],
      enums: [],
      documentTypes: [],
      relationSchemas: [dataFlow.id],
      fieldGroups: [],
      dashboard: false
    };

    const missingMappingPreview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'builtin', id: builtin.id },
        selection
      }
    });
    expect(missingMappingPreview.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Template dependency 'information-governance:data-flow:system' requires a mapping"
        )
      ])
    );

    const preview = await orpc.workspaces.definitionImportPreview({
      params: { workspace: target.url_slug },
      body: {
        source: { kind: 'builtin', id: builtin.id },
        selection,
        dependencyMappings: [
          { dependencyId: 'information-governance:data-flow:system', targetIds: [system.id] }
        ]
      }
    });
    expect(preview.errors).toEqual([]);
    expect(preview.schemaPatches).toEqual([
      expect.objectContaining({
        targetSchemaId: system.id,
        fields: expect.arrayContaining([
          expect.objectContaining({ id: 'data_flows_out' }),
          expect.objectContaining({ id: 'data_flows_in' })
        ])
      })
    ]);

    const result = await orpc.workspaces.definitionImportExecute({
      params: { workspace: target.url_slug },
      body: {
        source: preview.source,
        selection: preview.selection,
        renames: preview.renames,
        schemas: preview.schemas,
        enums: preview.enums,
        documentTypes: preview.documentTypes,
        relationSchemas: preview.relationSchemas,
        fieldGroups: preview.fieldGroups,
        dashboardWidgets: preview.dashboardWidgets,
        dependencyMappings: preview.dependencyMappings,
        schemaPatches: preview.schemaPatches,
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });
    expect(result.updatedSchemas).toBe(1);

    const [schemas, relationSchemas] = await Promise.all([
      server.db.catalog.listSchemas(target.id),
      server.db.relation.listRelationSchemas(target.id)
    ]);
    const importedDataEntity = schemas.find(schema => schema.name === 'Data Entity')!;
    const importedDataFlow = relationSchemas.find(schema => schema.name === 'Data Flow')!;
    expect(importedDataFlow.in_schema_ids).toEqual([system.id]);
    expect(importedDataFlow.out_schema_ids).toEqual([system.id]);
    expect(importedDataFlow.fields).toContainEqual(
      expect.objectContaining({ id: 'data_entities', schemaId: importedDataEntity.id })
    );
    expect(schemas.find(schema => schema.id === system.id)?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'data_flows_out', relationSchemaId: importedDataFlow.id }),
        expect.objectContaining({ id: 'data_flows_in', relationSchemaId: importedDataFlow.id })
      ])
    );
  });
});

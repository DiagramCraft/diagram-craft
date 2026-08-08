import { randomUUID } from 'node:crypto';
import { test, expect } from '../helpers/fixtures';

test.describe('definition import', () => {
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
      fieldGroups: []
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
      fieldGroups: preview.fieldGroups.length
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
          fieldGroups: []
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
        keyPrefixRemaps: renamedPreview.keyPrefixRemaps,
        fingerprint: renamedPreview.fingerprint,
        confirmed: true
      }
    });

    expect(await server.db.catalog.listSchemas(target.id)).toHaveLength(2);
    expect((await server.db.catalog.listSchemas(target.id)).map(schema => schema.name)).toContain(
      'Imported Domain'
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
          fieldGroups: [fieldGroup.id]
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
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });

    expect(result).toEqual({
      schemas: preview.schemas.length,
      enums: preview.enums.length,
      documentTypes: preview.documentTypes.length,
      relationSchemas: 1,
      fieldGroups: 1
    });

    const [createdSchemas, createdEnums, createdRelationSchemas, createdFieldGroups] =
      await Promise.all([
        server.db.catalog.listSchemas(target.id),
        server.db.catalog.listEnums(target.id),
        server.db.relation.listRelationSchemas(target.id),
        server.db.catalog.listSharedFieldGroups(target.id)
      ]);

    expect(createdRelationSchemas).toHaveLength(1);
    expect(createdFieldGroups).toHaveLength(1);
    expect(createdFieldGroups[0]!.name).toBe('PII Classification');

    const createdRelationSchema = createdRelationSchemas[0]!;
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
          fieldGroups: [fieldGroup.id]
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
          fieldGroups: [fieldGroup.id]
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
});

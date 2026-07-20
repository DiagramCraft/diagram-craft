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
      documentTypes: selectedDocumentType ? [selectedDocumentType.id] : []
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
        keyPrefixRemaps: preview.keyPrefixRemaps,
        fingerprint: preview.fingerprint,
        confirmed: true
      }
    });

    expect(result).toEqual({
      schemas: preview.schemas.length,
      enums: preview.enums.length,
      documentTypes: preview.documentTypes.length
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
        selection: { schemas: [selectedSchema.id], enums: [], documentTypes: [] }
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
});

import { randomUUID } from 'node:crypto';
import { test, expect } from '../helpers/fixtures';
import { NONEXISTENT_UUID } from '../helpers/testIds';
import { createTestORPCClient } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';
import { hashPassword } from '@arch-register/server/utils/password';

const suggestedResolutions = (parseResult: {
  conflicts: Array<{
    item_id: string;
    suggested_resolution: 'skip' | 'merge' | 'overwrite' | 'rename';
  }>;
}) =>
  Object.fromEntries(
    parseResult.conflicts.map(conflict => [
      conflict.item_id,
      { action: conflict.suggested_resolution }
    ])
  );

test.describe('workspace export/import', () => {
  test('exports and imports typed relation schemas and remapped relation endpoints', async ({
    orpc,
    server
  }) => {
    const suffix = randomUUID();
    const badgeSuffix = Array.from(suffix.replaceAll('-', '').slice(0, 4), character =>
      String.fromCharCode(65 + Number.parseInt(character, 16))
    ).join('');
    const source = await orpc.workspaces.create({
      body: { name: `Relation export source ${suffix}`, badge: `R${badgeSuffix}` }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: { name: `Relation entity schema ${suffix}` }
    });
    const inEntity = await orpc.entities.create({
      params: { workspace: source.url_slug },
      body: { _schemaId: schema.id, _name: `Relation source in ${suffix}` } as never
    });
    const outEntity = await orpc.entities.create({
      params: { workspace: source.url_slug },
      body: { _schemaId: schema.id, _name: `Relation source out ${suffix}` } as never
    });
    const relationSchemaId = randomUUID();
    const relationId = randomUUID();
    const now = new Date();
    await server.db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace: source.id,
      name: `Relation schema ${suffix}`,
      description: 'Exported relation schema',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [{ id: 'kind', name: 'Kind', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: '#123456',
      icon: 'link',
      relation_approval_policy: 'disabled',
      version: 1,
      created_at: now,
      updated_at: now
    });
    await server.db.relation.createRelation({
      id: relationId,
      workspace: source.id,
      schema_id: relationSchemaId,
      in_entity_id: inEntity._uid,
      out_entity_id: outEntity._uid,
      data: { kind: 'runtime' },
      version: 1,
      approval_policy_override: null,
      created_at: now,
      updated_at: now
    });

    const archive = await orpc.workspaces.export({
      params: { workspace: source.url_slug },
      body: {
        include: ['schemas', 'relation_schemas', 'entities', 'relations'],
        options: { include_content: false }
      }
    });
    const target = await orpc.workspaces.create({
      body: { name: `Relation import target ${suffix}`, badge: `T${badgeSuffix}` }
    });
    const parsed = await orpc.workspaces.importParse({
      params: { workspace: target.url_slug },
      body: {
        file: new File([archive.body as Blob], 'relations-export.zip', {
          type: 'application/zip'
        })
      }
    });
    expect(parsed.valid).toBe(true);
    expect(parsed.summary.relation_schemas).toEqual({ count: 1, conflicts: 0 });
    expect(parsed.summary.relations).toEqual({ count: 1, conflicts: 0 });

    const execute = await orpc.workspaces.importExecute({
      params: { workspace: target.url_slug },
      body: {
        import_id: (parsed as any).import_id,
        include: ['schemas', 'relation_schemas', 'entities', 'relations'],
        conflict_resolutions: suggestedResolutions(parsed as any),
        options: { preserve_ids: false, update_references: true }
      }
    });
    expect(execute.success).toBe(true);
    expect(execute.imported.relations).toEqual({ created: 1, updated: 0, skipped: 0 });

    const targetEntities = await server.db.catalog.listEntities(target.id);
    const targetIn = targetEntities.find(entity => entity.name === inEntity._name);
    const targetOut = targetEntities.find(entity => entity.name === outEntity._name);
    const targetRelations = (
      await server.db.relation.listRelations(
        target.id,
        { schemaId: null, inEntityId: null, outEntityId: null },
        {}
      )
    ).items;
    expect(targetRelations).toHaveLength(1);
    expect(targetRelations[0]).toEqual(
      expect.objectContaining({
        in_entity_id: targetIn?.id,
        out_entity_id: targetOut?.id,
        data: { kind: 'runtime' }
      })
    );
  });

  test('preserves field-group ACLs and hides restricted values after import', async ({
    orpc,
    server
  }) => {
    const suffix = Date.now().toString();
    const source = await orpc.workspaces.create({
      body: { name: `ACL export source ${suffix}`, badge: 'AES' }
    });
    const teams = await orpc.config.teams.list({ params: { workspace: source.url_slug } });
    const group = await orpc.fieldGroups.create({
      params: { workspace: source.url_slug },
      body: {
        name: `Restricted shared group ${suffix}`,
        fields: [{ id: `secret_${suffix}`, name: 'Secret', type: 'text' }]
      }
    });
    const schema = await orpc.schemas.create({
      params: { workspace: source.url_slug },
      body: {
        name: `ACL export schema ${suffix}`,
        shared_field_group_links: [{ groupId: group.id, teamIds: [teams[0]!.id] }]
      }
    });
    const entity = await orpc.entities.create({
      params: { workspace: source.url_slug },
      body: {
        _schemaId: schema.id,
        _name: `ACL export entity ${suffix}`,
        [`secret_${suffix}`]: 'imported secret'
      } as never
    });

    const archive = await orpc.workspaces.export({
      params: { workspace: source.url_slug },
      body: { include: ['schemas', 'entities'], options: { include_content: false } }
    });
    const target = await orpc.workspaces.create({
      body: { name: `ACL import target ${suffix}`, badge: 'AIT' }
    });
    const parsed = await orpc.workspaces.importParse({
      params: { workspace: target.url_slug },
      body: {
        file: new File([archive.body as Blob], 'acl-export.zip', { type: 'application/zip' })
      }
    });
    const execute = await orpc.workspaces.importExecute({
      params: { workspace: target.url_slug },
      body: {
        import_id: (parsed as any).import_id,
        include: ['schemas', 'entities'],
        conflict_resolutions: suggestedResolutions(parsed as any),
        options: { preserve_ids: false, update_references: true }
      }
    });
    expect(execute.success).toBe(true);

    const importedSchemas = await server.db.catalog.listSchemas(target.id);
    const importedSchema = importedSchemas.find(item => item.name === schema.name);
    expect(importedSchema).toEqual(
      expect.objectContaining({
        groups: expect.arrayContaining([
          expect.objectContaining({ accessControl: { teamIds: expect.any(Array) } })
        ]),
        shared_field_group_links: expect.arrayContaining([
          expect.objectContaining({ teamIds: expect.any(Array) })
        ])
      })
    );
    const importedEntity = (await server.db.catalog.listEntities(target.id)).find(
      item => item.name === entity._name
    );
    expect(importedEntity?.data[`secret_${suffix}`]).toBe('imported secret');

    const now = new Date();
    const viewerId = `00000000-0000-0000-0000-${suffix.slice(-12).padStart(12, '0')}`;
    await server.db.auth.createUser({
      id: viewerId,
      user_id: `acl-import-viewer-${suffix}`,
      email: `acl-import-viewer-${suffix}@e2e.test`,
      display_name: 'ACL import viewer',
      auth_provider: 'local',
      password_hash: await hashPassword('TestPassword123!'),
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      color: null,
      created_at: now,
      updated_at: now,
      last_login_at: null
    });
    await server.db.workspace.setWorkspaceMemberRole(target.id, viewerId, 'viewer', now);
    const viewer = createTestORPCClient(server.baseUrl, await makeAuthHeader(server.db, viewerId));
    const visible = await viewer.entities.get({
      params: { workspace: target.url_slug, id: importedEntity!.id }
    });
    expect(visible).not.toHaveProperty(`secret_${suffix}`);
  });

  test.describe('export', () => {
    test('POST /api/:workspace/export exports workspace with all data types', async ({ orpc }) => {
      const response = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['config', 'schemas', 'entities', 'projects', 'content_nodes'],
          options: { include_content: true }
        }
      });

      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.zip');
      expect(response.body).toBeInstanceOf(Blob);

      const blob = response.body as Blob;
      expect(blob.size).toBeGreaterThan(0);
    });

    test('POST /api/:workspace/export exports workspace with selected data types', async ({
      orpc
    }) => {
      const response = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['schemas', 'entities'],
          options: { include_content: false }
        }
      });

      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.body).toBeInstanceOf(Blob);
    });

    test('POST /api/:workspace/export exports workspace without content files', async ({
      orpc
    }) => {
      const response = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['config', 'schemas', 'entities'],
          options: { include_content: false }
        }
      });

      expect(response.body).toBeInstanceOf(Blob);
      const blob = response.body as Blob;
      expect(blob.size).toBeGreaterThan(0);
    });

    test('POST /api/:workspace/export returns 404 for non-existent workspace', async ({ orpc }) => {
      await expect(
        orpc.workspaces.export({
          params: { workspace: NONEXISTENT_UUID },
          body: {
            include: ['config'],
            options: {}
          }
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    test('POST /api/:workspace/export succeeds with proper permissions', async ({ orpc }) => {
      // Create a workspace
      const workspace = await orpc.workspaces.create({ body: { name: 'Export Test Workspace' } });

      // Export with default user who has permissions
      const response = await orpc.workspaces.export({
        params: { workspace: workspace.url_slug },
        body: {
          include: ['config'],
          options: {}
        }
      });

      expect(response.body).toBeInstanceOf(Blob);
    });
  });

  test.describe('import parse', () => {
    test('POST /api/:workspace/import/parse validates and parses import file', async ({ orpc }) => {
      // First export a workspace to get a valid ZIP file
      const exportResponse = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['config', 'schemas', 'entities'],
          options: { include_content: false }
        }
      });

      const exportBlob = exportResponse.body as Blob;
      const exportFile = new File([exportBlob], 'export.zip', { type: 'application/zip' });

      // Create a new workspace to import into
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Import Target Workspace' }
      });

      // Parse the import file
      const parseResult = (await orpc.workspaces.importParse({
        params: { workspace: targetWorkspace.url_slug },
        body: { file: exportFile }
      })) as any;

      expect(parseResult).toMatchObject({
        valid: true,
        version: expect.any(String),
        source_workspace: {
          id: expect.any(String),
          name: 'Default Workspace',
          url_slug: 'default'
        },
        available_data_types: expect.arrayContaining(['config', 'schemas', 'entities']),
        summary: expect.objectContaining({
          config: expect.any(Object),
          schemas: expect.any(Object),
          entities: expect.any(Object)
        }),
        conflicts: expect.any(Array),
        errors: expect.any(Array),
        warnings: expect.any(Array)
      });

      // Verify import_id is returned
      expect(parseResult).toHaveProperty('import_id');
      expect(typeof parseResult.import_id).toBe('string');
    });

    test('POST /api/:workspace/import/parse rejects invalid file format', async ({ orpc }) => {
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Import Invalid File Test' }
      });

      // Create an invalid file (not a ZIP)
      const invalidFile = new File(['not a zip file'], 'invalid.txt', { type: 'text/plain' });

      await expect(
        orpc.workspaces.importParse({
          params: { workspace: targetWorkspace.url_slug },
          body: { file: invalidFile }
        })
      ).rejects.toMatchObject({
        code: expect.stringMatching(/BAD_REQUEST|INTERNAL_SERVER_ERROR/)
      });
    });

    test('POST /api/:workspace/import/parse returns 404 for non-existent workspace', async ({
      orpc
    }) => {
      const dummyFile = new File(['dummy'], 'dummy.zip', { type: 'application/zip' });

      await expect(
        orpc.workspaces.importParse({
          params: { workspace: NONEXISTENT_UUID },
          body: { file: dummyFile }
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  test.describe('import execute', () => {
    test('POST /api/:workspace/import/execute imports data successfully', async ({
      orpc,
      server
    }) => {
      // Export from source workspace
      const exportResponse = await orpc.workspaces.export({
        params: { workspace: 'default' },
        body: {
          include: ['config', 'schemas'],
          options: { include_content: false }
        }
      });

      const exportBlob = exportResponse.body as Blob;
      const exportFile = new File([exportBlob], 'export.zip', { type: 'application/zip' });

      // Create target workspace
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Import Execute Test Workspace' }
      });

      // Parse the import
      const parseResult = await orpc.workspaces.importParse({
        params: { workspace: targetWorkspace.url_slug },
        body: { file: exportFile }
      });

      expect((parseResult as any).import_id).toBeDefined();

      // Execute the import
      const executeResult = await orpc.workspaces.importExecute({
        params: { workspace: targetWorkspace.url_slug },
        body: {
          import_id: (parseResult as any).import_id!,
          include: ['config', 'schemas'],
          conflict_resolutions: suggestedResolutions(parseResult),
          options: {
            preserve_ids: false,
            update_references: true
          }
        }
      });

      expect(executeResult).toMatchObject({
        success: true,
        imported: expect.objectContaining({
          config: expect.any(Object),
          schemas: expect.any(Object)
        }),
        errors: [],
        warnings: expect.any(Array)
      });

      // Verify data was imported
      const lifecycleStates = await server.db.workspace.listLifecycleStates(targetWorkspace.id);
      expect(lifecycleStates.length).toBeGreaterThan(0);
    });

    test('POST /api/:workspace/import/execute returns 404 for expired/invalid import_id', async ({
      orpc
    }) => {
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Import Expired Test' }
      });

      await expect(
        orpc.workspaces.importExecute({
          params: { workspace: targetWorkspace.url_slug },
          body: {
            import_id: NONEXISTENT_UUID,
            include: ['config'],
            conflict_resolutions: {},
            options: {}
          }
        })
      ).rejects.toMatchObject({
        code: expect.stringMatching(/NOT_FOUND|BAD_REQUEST/)
      });
    });

    test('POST /api/:workspace/import/execute returns 404 for non-existent workspace', async ({
      orpc
    }) => {
      await expect(
        orpc.workspaces.importExecute({
          params: { workspace: NONEXISTENT_UUID },
          body: {
            import_id: NONEXISTENT_UUID,
            include: ['config'],
            conflict_resolutions: {},
            options: {}
          }
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  test.describe('full export/import flow', () => {
    test('complete export and import cycle preserves data', async ({ orpc, server }) => {
      // Create source workspace with custom data
      const sourceWorkspace = await orpc.workspaces.create({
        body: {
          name: 'Source Workspace for Full Test',
          description: 'Test workspace with custom data'
        }
      });

      // Export the source workspace
      const exportResponse = await orpc.workspaces.export({
        params: { workspace: sourceWorkspace.url_slug },
        body: {
          include: ['config', 'schemas', 'entities', 'projects'],
          options: { include_content: false }
        }
      });

      const exportBlob = exportResponse.body as Blob;
      expect(exportBlob.size).toBeGreaterThan(0);

      // Create target workspace
      const targetWorkspace = await orpc.workspaces.create({
        body: { name: 'Target Workspace for Full Test' }
      });

      // Import into target workspace
      const exportFile = new File([exportBlob], 'export.zip', { type: 'application/zip' });

      const parseResult = await orpc.workspaces.importParse({
        params: { workspace: targetWorkspace.url_slug },
        body: { file: exportFile }
      });

      expect(parseResult.valid).toBe(true);
      expect((parseResult as any).import_id).toBeDefined();

      const executeResult = await orpc.workspaces.importExecute({
        params: { workspace: targetWorkspace.url_slug },
        body: {
          import_id: (parseResult as any).import_id!,
          include: ['config', 'schemas', 'entities', 'projects'],
          conflict_resolutions: suggestedResolutions(parseResult),
          options: {
            preserve_ids: false,
            update_references: true
          }
        }
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.errors).toHaveLength(0);

      // Verify imported data
      const targetLifecycleStates = await server.db.workspace.listLifecycleStates(
        targetWorkspace.id
      );
      const sourceLifecycleStates = await server.db.workspace.listLifecycleStates(
        sourceWorkspace.id
      );

      expect(targetLifecycleStates.length).toBe(sourceLifecycleStates.length);
      expect(targetLifecycleStates.map(s => s.label)).toEqual(
        sourceLifecycleStates.map(s => s.label)
      );
    });
  });
});

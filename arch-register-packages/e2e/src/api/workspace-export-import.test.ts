import { test, expect } from '../helpers/fixtures';
import { NONEXISTENT_UUID } from '../helpers/testIds';

test.describe('workspace export/import', () => {
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

    test('POST /api/:workspace/export exports workspace with selected data types', async ({ orpc }) => {
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

    test('POST /api/:workspace/export exports workspace without content files', async ({ orpc }) => {
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
      const parseResult = await orpc.workspaces.importParse({
        params: { workspace: targetWorkspace.url_slug },
        body: { file: exportFile }
      }) as any;

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

    test('POST /api/:workspace/import/parse returns 404 for non-existent workspace', async ({ orpc }) => {
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
    test('POST /api/:workspace/import/execute imports data successfully', async ({ orpc, server }) => {
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
          conflict_resolutions: {},
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

    test('POST /api/:workspace/import/execute returns 404 for expired/invalid import_id', async ({ orpc }) => {
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

    test('POST /api/:workspace/import/execute returns 404 for non-existent workspace', async ({ orpc }) => {
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
          conflict_resolutions: {},
          options: {
            preserve_ids: false,
            update_references: true
          }
        }
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.errors).toHaveLength(0);

      // Verify imported data
      const targetLifecycleStates = await server.db.workspace.listLifecycleStates(targetWorkspace.id);
      const sourceLifecycleStates = await server.db.workspace.listLifecycleStates(sourceWorkspace.id);
      
      expect(targetLifecycleStates.length).toBe(sourceLifecycleStates.length);
      expect(targetLifecycleStates.map(s => s.label)).toEqual(
        sourceLifecycleStates.map(s => s.label)
      );
    });
  });
});

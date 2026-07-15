import { test, expect, createTestORPCClient, createApiTest } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';
import type { TestORPCClient } from '../helpers/orpcTestClient';

const systemId = '00000000-0000-0000-0002-000000000001';

const entityTest = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
  }
});

const minimalDiagramDocument = (name: string) => ({
  name,
  diagrams: []
});

const createProject = async (
  orpc: TestORPCClient,
  body: {
    name: string;
    description?: unknown;
    owner?: string | null;
    status?: 'draft' | 'active' | 'complete' | 'cancelled';
    pinned?: boolean;
    color?: string | null | number;
  }
) =>
  orpc.projects.create({
    params: { workspace: 'default' },
    body: body as Parameters<typeof orpc.projects.create>[0]['body']
  });

const uploadMarkdownAttachment = async (
  baseUrl: string,
  auth: string,
  nodeId: string,
  fileName: string,
  body: string
) => {
  const formData = new FormData();
  formData.append('file', new Blob([body], { type: 'text/plain' }), fileName);
  const response = await fetch(
    `${baseUrl}/api/default/markdown/${nodeId}/attachments/upload?path=${encodeURIComponent(fileName)}`,
    {
      method: 'POST',
      headers: { Authorization: auth },
      body: formData
    }
  );

  expect(response.ok).toBe(true);
  return response.json();
};

test.describe('project routes', () => {
  test('GET /api/:workspace/projects lists created projects', async ({ orpc }) => {
    await createProject(orpc, {
      name: 'Portal Redesign',
      owner: seedIds.teams.design,
      status: 'active'
    });
    await createProject(orpc, {
      name: 'Auth Migration',
      owner: seedIds.teams.security,
      status: 'active',
      pinned: true
    });

    const projects = await orpc.projects.list({ params: { workspace: 'default' } });

    expect(projects.length).toBeGreaterThanOrEqual(2);
    expect(projects).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Auth Migration', pinned: true })])
    );
  });

  test('GET /api/:workspace/entities/:entityId/projects returns linked projects directly', async ({
    orpc,
    server
  }) => {
    await seedCatalogEntities(server.db);
    const project = await createProject(orpc, {
      name: 'Entity Lookup Project',
      owner: seedIds.teams.design
    });
    await orpc.projects.addEntity({
      params: { workspace: 'default', id: project.id },
      body: { entity_id: systemId }
    });

    const projects = await orpc.projects.listEntityProjects({
      params: { workspace: 'default', entityId: systemId }
    });

    expect(projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          project: expect.objectContaining({ id: project.id, name: 'Entity Lookup Project' }),
          entity_type: null
        })
      ])
    );
  });

  test('GET /api/:workspace/projects returns 401 without authentication', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.projects.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('GET /api/:workspace/projects/:id returns project detail', async ({ orpc }) => {
    const created = await createProject(orpc, {
      name: 'Detail Project',
      description: 'Project detail test',
      owner: seedIds.teams.design,
      pinned: true
    });

    const project = await orpc.projects.get({ params: { workspace: 'default', id: created.id } });

    expect(project).toMatchObject({
      id: created.id,
      name: 'Detail Project',
      pinned: true
    });
    expect(project.files).toEqual({ folders: [], rootFiles: [] });
  });

  test('POST /api/:workspace/projects creates a project with normalized optional fields', async ({
    orpc
  }) => {
    const project = await orpc.projects.create({
      params: { workspace: 'default' },
      body: { name: 'Coverage Project', description: undefined, owner: undefined, color: undefined }
    });

    expect(project).toMatchObject({
      name: 'Coverage Project',
      description: '',
      owner: null,
      status: 'active',
      color: null
    });
  });

  test('POST /api/:workspace/projects returns 409 for duplicate project names', async ({
    orpc
  }) => {
    await createProject(orpc, { name: 'Duplicate Project' });

    await expect(
      orpc.projects.create({
        params: { workspace: 'default' },
        body: { name: 'Duplicate Project' }
      })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A project with that name already exists in this workspace'
    });
  });

  test('PUT /api/:workspace/projects/:id updates a project and preserves omitted fields', async ({
    orpc
  }) => {
    const created = await createProject(orpc, {
      name: 'Mutable Project',
      description: 'Original',
      owner: seedIds.teams.design,
      status: 'active',
      pinned: true,
      color: '#445566'
    });

    const updated = await orpc.projects.update({
      params: { workspace: 'default', id: created.id },
      body: { name: 'Renamed Project' }
    });

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Renamed Project',
      description: 'Original',
      owner: expect.objectContaining({ id: seedIds.teams.design }),
      pinned: true,
      color: '#445566'
    });
  });

  test('DELETE /api/:workspace/projects/:id deletes a project', async ({ orpc }) => {
    const created = await createProject(orpc, { name: 'Delete Project' });

    const result = await orpc.projects.remove({
      params: { workspace: 'default', id: created.id }
    });

    expect(result).toEqual({ success: true, message: `Project '${created.id}' deleted` });
  });

  test('GET /api/:workspace/projects/:id/files returns a file tree', async ({ orpc }) => {
    const created = await createProject(orpc, { name: 'Tree Project' });
    const projectId = created.id;

    await orpc.projects.createFolder({
      params: { workspace: 'default', id: projectId },
      body: { path: 'current-state' }
    });
    await orpc.projects.saveFile({
      params: { workspace: 'default', id: projectId },
      query: { path: 'overview.dgc' },
      body: minimalDiagramDocument('Overview')
    });

    const files = await orpc.projects.listFiles({
      params: { workspace: 'default', id: projectId }
    });

    expect(files.rootFiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'overview.dgc' })])
    );
    expect(files.folders).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'current-state' })])
    );
  });

  test('project file routes create, read, relocate, and delete files', async ({ orpc }) => {
    const created = await createProject(orpc, { name: 'File Project' });
    const projectId = created.id;

    const writeResult = await orpc.projects.saveFile({
      params: { workspace: 'default', id: projectId },
      query: { path: 'flows/login-sequence.dgc' },
      body: minimalDiagramDocument('Login Sequence')
    });

    expect(writeResult).toMatchObject({
      project_id: projectId,
      path: 'flows/login-sequence.dgc',
      name: 'Login Sequence'
    });

    const readResult = await orpc.projects.getFileContent({
      params: { workspace: 'default', id: projectId },
      query: { path: 'flows/login-sequence.dgc' }
    });

    expect(readResult).toEqual(minimalDiagramDocument('Login Sequence'));

    const relocateResult = await orpc.projects.relocateFile({
      params: { workspace: 'default', id: projectId },
      query: { path: 'flows/login-sequence.dgc' },
      body: { newPath: 'archive/auth-sequence.json' }
    });

    expect(relocateResult).toMatchObject({
      project_id: projectId,
      path: 'archive/auth-sequence.json',
      name: 'auth-sequence'
    });

    const relocatedReadResult = await orpc.projects.getFileContent({
      params: { workspace: 'default', id: projectId },
      query: { path: 'archive/auth-sequence.json' }
    });

    expect(relocatedReadResult).toEqual({ name: 'auth-sequence', diagrams: [] });

    const deleteResult = await orpc.projects.deleteFile({
      params: { workspace: 'default', id: projectId },
      query: { path: 'archive/auth-sequence.json' }
    });

    expect(deleteResult).toEqual({ success: true });
  });

  test('project folder routes create, rename, and delete folders', async ({ orpc }) => {
    const created = await createProject(orpc, { name: 'Folder Project' });
    const projectId = created.id;

    const createResult = await orpc.projects.createFolder({
      params: { workspace: 'default', id: projectId },
      body: { path: 'drafts' }
    });

    expect(createResult).toMatchObject({ success: true, path: 'drafts' });

    const renameResult = await orpc.projects.renameFolder({
      params: { workspace: 'default', id: projectId },
      body: { oldPath: 'drafts', newPath: 'review' }
    });

    expect(renameResult).toMatchObject({ success: true, count: 1 });

    const deleteFolderResult = await orpc.projects.deleteFolder({
      params: { workspace: 'default', id: projectId },
      query: { path: 'review' }
    });

    expect(deleteFolderResult).toMatchObject({ success: true, count: 1 });
  });

  test('project content routes accept project public ids', async ({ orpc }) => {
    const created = await createProject(orpc, { name: 'Public Id Content Project' });
    const projectId = created.public_id;

    const folderResult = await orpc.projects.createFolder({
      params: { workspace: 'default', id: projectId },
      body: { path: 'docs' }
    });
    expect(folderResult).toMatchObject({ success: true, path: 'docs' });

    const markdownResult = await orpc.projects.createProjectMarkdown({
      params: { workspace: 'default', id: projectId },
      body: { name: 'Architecture overview', folder: 'docs' }
    });
    expect(markdownResult).toMatchObject({
      project_id: created.id,
      path: 'docs/Architecture overview.md',
      type: 'markdown'
    });

    const diagramResult = await orpc.projects.saveFile({
      params: { workspace: 'default', id: projectId },
      query: { path: 'docs/overview.json' },
      body: minimalDiagramDocument('Overview')
    });
    expect(diagramResult).toMatchObject({
      project_id: created.id,
      path: 'docs/overview.json',
      name: 'Overview'
    });

    const files = await orpc.projects.listFiles({
      params: { workspace: 'default', id: projectId }
    });
    expect(files.folders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'docs',
          files: expect.arrayContaining([
            expect.objectContaining({ path: 'docs/Architecture overview.md', type: 'markdown' }),
            expect.objectContaining({ path: 'docs/overview.json', type: 'diagram' })
          ])
        })
      ])
    );
  });

  test('saving markdown updates the document name from the first h1 without renaming the path', async ({
    orpc
  }) => {
    const created = await createProject(orpc, { name: 'Markdown Title Project' });

    const markdownResult = await orpc.projects.createProjectMarkdown({
      params: { workspace: 'default', id: created.public_id },
      body: { name: 'Untitled document' }
    });

    const saved = await orpc.projects.saveMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id },
      body: { body: '# Architecture Decision\n\nDetails', name: 'Architecture Decision' }
    });

    expect(saved).toMatchObject({
      id: markdownResult.id,
      name: 'Architecture Decision',
      path: 'Untitled document.md',
      type: 'markdown'
    });

    const savedWithoutHeading = await orpc.projects.saveMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id },
      body: { body: 'No heading anymore' }
    });

    expect(savedWithoutHeading).toMatchObject({
      id: markdownResult.id,
      name: 'Architecture Decision',
      path: 'Untitled document.md',
      type: 'markdown'
    });
  });

  test('markdown revisions can be listed, fetched, and restored for project content', async ({
    orpc
  }) => {
    const created = await createProject(orpc, { name: 'Markdown History Project' });
    const markdownResult = await orpc.projects.createProjectMarkdown({
      params: { workspace: 'default', id: created.public_id },
      body: { name: 'ADR' }
    });

    await orpc.projects.saveMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id },
      body: { body: '# First title\n\nFirst body', name: 'First title' }
    });
    await orpc.projects.saveMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id },
      body: { body: '# Second title\n\nSecond body', name: 'Second title' }
    });

    const revisions = await orpc.projects.listMarkdownRevisions({
      params: { workspace: 'default', nodeId: markdownResult.id }
    });

    expect(revisions).toHaveLength(2);
    expect(revisions[0]).toMatchObject({
      revision_number: 2,
      title: 'Second title'
    });
    expect(revisions[1]).toMatchObject({
      revision_number: 1,
      title: 'First title'
    });

    const firstRevision = await orpc.projects.getMarkdownRevision({
      params: { workspace: 'default', nodeId: markdownResult.id, revisionId: revisions[1]!.id }
    });

    expect(firstRevision.body).toContain('First body');

    const restored = await orpc.projects.restoreMarkdownRevision({
      params: { workspace: 'default', nodeId: markdownResult.id, revisionId: revisions[1]!.id }
    });

    expect(restored).toMatchObject({
      id: markdownResult.id,
      name: 'First title'
    });

    const restoredContent = await orpc.projects.getMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id }
    });
    expect(restoredContent.body).toContain('First body');

    const revisionsAfterRestore = await orpc.projects.listMarkdownRevisions({
      params: { workspace: 'default', nodeId: markdownResult.id }
    });
    expect(revisionsAfterRestore[0]).toMatchObject({
      revision_number: 3,
      title: 'First title',
      restored_from_revision_id: revisions[1]!.id
    });
  });

  test('workspace markdown revisions can be created and restored', async ({ orpc }) => {
    const markdownResult = await orpc.projects.createWorkspaceMarkdown({
      params: { workspace: 'default' },
      body: { name: 'Workspace wiki' }
    });

    await orpc.projects.saveMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id },
      body: { body: '# Workspace title\n\nAlpha', name: 'Workspace title' }
    });
    await orpc.projects.saveMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id },
      body: { body: '# Workspace title\n\nBeta', name: 'Workspace title' }
    });

    const revisions = await orpc.projects.listMarkdownRevisions({
      params: { workspace: 'default', nodeId: markdownResult.id }
    });
    expect(revisions).toHaveLength(2);

    await orpc.projects.restoreMarkdownRevision({
      params: { workspace: 'default', nodeId: markdownResult.id, revisionId: revisions[1]!.id }
    });

    const restoredContent = await orpc.projects.getMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id }
    });
    expect(restoredContent.body).toContain('Alpha');
  });

  test('markdown attachments can be uploaded through the markdown page endpoint', async ({
    orpc,
    server,
    auth
  }) => {
    const created = await createProject(orpc, { name: 'Attachment Project' });
    const markdownResult = await orpc.projects.createProjectMarkdown({
      params: { workspace: 'default', id: created.public_id },
      body: { name: 'Architecture overview', folder: 'docs' }
    });

    const uploaded = await uploadMarkdownAttachment(
      server.baseUrl,
      auth,
      markdownResult.id,
      'notes.txt',
      'attachment body'
    );

    expect(uploaded).toMatchObject({
      type: 'file',
      name: 'notes.txt',
      original_filename: 'notes.txt',
      mime_type: 'text/plain',
      path: 'docs/Architecture overview/__attachments/notes.txt'
    });

    const markdownContent = await orpc.projects.getMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id }
    });

    expect(markdownContent.attachments).toEqual([
      expect.objectContaining({
        id: uploaded.id,
        type: 'file',
        path: 'docs/Architecture overview/__attachments/notes.txt'
      })
    ]);
  });
});

entityTest.describe('entity content routes', () => {
  entityTest('entity content routes accept entity public ids', async ({ orpc }) => {
    const entity = await orpc.entities.create({
      params: { workspace: 'default' },
      body: {
        _schemaId: '00000000-0000-0000-0000-000000000004',
        _name: 'Entity Content Host',
        _namespace: 'default',
        api_type: 'openapi',
        system: [systemId]
      } as never
    });

    const entityId = entity._publicId;

    const folderResult = await orpc.projects.createEntityFolder({
      params: { workspace: 'default', entityId },
      body: { path: 'docs' }
    });
    expect(folderResult).toMatchObject({ success: true, path: 'docs' });

    const markdownResult = await orpc.projects.createEntityMarkdown({
      params: { workspace: 'default', entityId },
      body: { name: 'Architecture overview', folder: 'docs' }
    });
    expect(markdownResult).toMatchObject({
      project_id: null,
      path: 'docs/Architecture overview.md',
      type: 'markdown'
    });

    const diagramResult = await orpc.projects.createEntityFile({
      params: { workspace: 'default', entityId },
      query: { path: 'docs/overview.json' },
      body: minimalDiagramDocument('Overview') as never
    });
    expect(diagramResult).toMatchObject({
      project_id: null,
      path: 'docs/overview.json',
      name: 'Overview',
      type: 'diagram'
    });

    const files = await orpc.projects.listEntityFiles({
      params: { workspace: 'default', entityId }
    });
    expect(files.folders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'docs',
          files: expect.arrayContaining([
            expect.objectContaining({ path: 'docs/Architecture overview.md', type: 'markdown' }),
            expect.objectContaining({ path: 'docs/overview.json', type: 'diagram' })
          ])
        })
      ])
    );
  });

  entityTest('entity markdown revisions can be created and restored', async ({ orpc }) => {
    const entity = await orpc.entities.create({
      params: { workspace: 'default' },
      body: {
        _schemaId: '00000000-0000-0000-0000-000000000004',
        _name: 'Entity Revision Host',
        _namespace: 'default',
        api_type: 'openapi',
        system: [systemId]
      } as never
    });

    const markdownResult = await orpc.projects.createEntityMarkdown({
      params: { workspace: 'default', entityId: entity._publicId },
      body: { name: 'Entity wiki' }
    });

    await orpc.projects.saveMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id },
      body: { body: '# Entity title\n\nOne', name: 'Entity title' }
    });
    await orpc.projects.saveMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id },
      body: { body: '# Entity title\n\nTwo', name: 'Entity title' }
    });

    const revisions = await orpc.projects.listMarkdownRevisions({
      params: { workspace: 'default', nodeId: markdownResult.id }
    });
    expect(revisions).toHaveLength(2);

    await orpc.projects.restoreMarkdownRevision({
      params: { workspace: 'default', nodeId: markdownResult.id, revisionId: revisions[1]!.id }
    });

    const restoredContent = await orpc.projects.getMarkdownContent({
      params: { workspace: 'default', nodeId: markdownResult.id }
    });
    expect(restoredContent.body).toContain('One');
  });
});

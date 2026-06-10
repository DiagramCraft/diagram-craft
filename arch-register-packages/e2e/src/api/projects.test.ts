import { test, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';
import type { TestORPCClient } from '../helpers/orpcTestClient';

const minimalDiagramDocument = (name: string) => ({
  name,
  diagrams: []
});

const createProject = async (
  orpc: TestORPCClient,
  body: { name: string; description?: unknown; owner?: string | null; status?: 'pinned' | 'active' | 'archived'; color?: string | null | number }
) => orpc.projects.create({ params: { workspace: 'default' }, body: body as Parameters<typeof orpc.projects.create>[0]['body'] });

test.describe('project routes', () => {
  test('GET /api/:workspace/projects lists created projects', async ({ orpc }) => {
    await createProject(orpc, { name: 'Portal Redesign', owner: seedIds.teams.design, status: 'active' });
    await createProject(orpc, { name: 'Auth Migration', owner: seedIds.teams.security, status: 'pinned' });

    const projects = await orpc.projects.list({ params: { workspace: 'default' } });

    expect(projects.length).toBeGreaterThanOrEqual(2);
    expect(projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Auth Migration', status: 'pinned' })
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
      status: 'pinned'
    });

    const project = await orpc.projects.get({ params: { workspace: 'default', id: created.id } });

    expect(project).toMatchObject({
      id: created.id,
      name: 'Detail Project',
      status: 'pinned'
    });
    expect(project.files).toEqual({ folders: [], rootFiles: [] });
  });

  test('POST /api/:workspace/projects creates a project with normalized optional fields', async ({ orpc }) => {
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

  test('POST /api/:workspace/projects returns 409 for duplicate project names', async ({ orpc }) => {
    await createProject(orpc, { name: 'Duplicate Project' });

    await expect(
      orpc.projects.create({ params: { workspace: 'default' }, body: { name: 'Duplicate Project' } })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A project with that name already exists in this workspace'
    });
  });

  test('PUT /api/:workspace/projects/:id updates a project and preserves omitted fields', async ({ orpc }) => {
    const created = await createProject(orpc, {
      name: 'Mutable Project',
      description: 'Original',
      owner: seedIds.teams.design,
      status: 'pinned',
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
      status: 'pinned',
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

  test('GET /api/:workspace/projects/:id/files returns a file tree', async ({ server, orpc, auth }) => {
    const created = await createProject(orpc, { name: 'Tree Project' });
    const projectId = created.id;

    await orpc.projects.createFolder({
      params: { workspace: 'default', id: projectId },
      body: { path: 'current-state' }
    });
    await fetch(`${server.baseUrl}/api/default/projects/${projectId}/files/overview.dgc`, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalDiagramDocument('Overview'))
    });

    const files = await orpc.projects.listFiles({ params: { workspace: 'default', id: projectId } });

    expect(files.rootFiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'overview.dgc' })])
    );
    expect(files.folders).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'current-state' })])
    );
  });

  test('project file routes create, read, relocate, and delete files', async ({ server, orpc, auth }) => {
    const created = await createProject(orpc, { name: 'File Project' });
    const projectId = created.id;

    const writeRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/files/flows/login-sequence.dgc`,
      {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalDiagramDocument('Login Sequence'))
      }
    );

    expect(writeRes.status).toBe(200);
    await expect(writeRes.json()).resolves.toMatchObject({
      project_id: projectId,
      path: 'flows/login-sequence.dgc',
      name: 'Login Sequence'
    });

    const readRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/files/flows/login-sequence.dgc`,
      { headers: { Authorization: auth } }
    );

    expect(readRes.status).toBe(200);
    await expect(readRes.json()).resolves.toEqual(minimalDiagramDocument('Login Sequence'));

    const relocateRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/files/relocate/flows/login-sequence.dgc`,
      {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPath: 'archive/auth-sequence.json' })
      }
    );

    expect(relocateRes.status).toBe(200);
    await expect(relocateRes.json()).resolves.toMatchObject({
      project_id: projectId,
      path: 'archive/auth-sequence.json',
      name: 'auth-sequence'
    });

    const relocatedReadRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/files/archive/auth-sequence.json`,
      { headers: { Authorization: auth } }
    );

    expect(relocatedReadRes.status).toBe(200);
    await expect(relocatedReadRes.json()).resolves.toEqual({ name: 'auth-sequence', diagrams: [] });

    const deleteRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/files/archive/auth-sequence.json`,
      { method: 'DELETE', headers: { Authorization: auth } }
    );

    expect(deleteRes.status).toBe(200);
    await expect(deleteRes.json()).resolves.toEqual({
      success: true,
      message: "File 'archive/auth-sequence.json' deleted"
    });
  });

  test('project folder routes create, rename, and delete folders', async ({ server, orpc, auth }) => {
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

    const deleteFolderRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/folders/review`,
      { method: 'DELETE', headers: { Authorization: auth } }
    );

    expect(deleteFolderRes.status).toBe(200);
    await expect(deleteFolderRes.json()).resolves.toMatchObject({ success: true, count: 1 });
  });
});

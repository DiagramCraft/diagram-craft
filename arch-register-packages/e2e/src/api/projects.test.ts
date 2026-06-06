import { test, expect } from '../helpers/fixtures';

const minimalDiagramDocument = (name: string) => ({
  name,
  diagrams: []
});

const createProject = async (
  baseUrl: string,
  auth: string,
  body: Record<string, unknown>
) => {
  const res = await fetch(`${baseUrl}/api/default/projects`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
};

test.describe('project routes', () => {
  test('GET /api/:workspace/projects lists created projects', async ({ server, auth }) => {
    await createProject(server.baseUrl, auth, {
      name: 'Portal Redesign',
      owner: 'Design Systems',
      status: 'active'
    });
    await createProject(server.baseUrl, auth, {
      name: 'Auth Migration',
      owner: 'Security & Compliance',
      status: 'pinned'
    });

    const res = await fetch(`${server.baseUrl}/api/default/projects`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Auth Migration',
          status: 'pinned'
        })
      ])
    );
  });

  test('GET /api/:workspace/projects returns 401 without authentication', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/default/projects`);
    expect(res.status).toBe(401);
  });

  test('GET /api/:workspace/projects/:id returns project detail', async ({ server, auth }) => {
    const created = await createProject(server.baseUrl, auth, {
      name: 'Detail Project',
      description: 'Project detail test',
      owner: 'Design Systems',
      status: 'pinned'
    });

    const res = await fetch(`${server.baseUrl}/api/default/projects/${created['id']}`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      id: created['id'],
      name: 'Detail Project',
      status: 'pinned'
    });
    expect(body['files']).toEqual({
      folders: [],
      rootFiles: []
    });
  });

  test('POST /api/:workspace/projects creates a project with normalized optional fields', async ({ server, auth }) => {
    const body = await createProject(server.baseUrl, auth, {
      name: 'Coverage Project',
      description: 123,
      owner: 'missing-team',
      color: 99
    });

    expect(body).toMatchObject({
      name: 'Coverage Project',
      description: '',
      owner: null,
      status: 'active',
      color: null
    });
  });

  test('POST /api/:workspace/projects returns 409 for duplicate project names', async ({ server, auth }) => {
    await createProject(server.baseUrl, auth, {
      name: 'Duplicate Project'
    });

    const res = await fetch(`${server.baseUrl}/api/default/projects`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Duplicate Project'
      })
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      message: 'A project with that name already exists in this workspace'
    });
  });

  test('PUT /api/:workspace/projects/:id updates a project and preserves omitted fields', async ({ server, auth }) => {
    const created = await createProject(server.baseUrl, auth, {
      name: 'Mutable Project',
      description: 'Original',
      owner: 'Design Systems',
      status: 'pinned',
      color: '#445566'
    });

    const res = await fetch(`${server.baseUrl}/api/default/projects/${created['id']}`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Renamed Project'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: created['id'],
      name: 'Renamed Project',
      description: 'Original',
      owner: 'Design Systems',
      status: 'pinned',
      color: '#445566'
    });
  });

  test('DELETE /api/:workspace/projects/:id deletes a project', async ({ server, auth }) => {
    const created = await createProject(server.baseUrl, auth, {
      name: 'Delete Project'
    });

    const res = await fetch(`${server.baseUrl}/api/default/projects/${created['id']}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      message: `Project '${created['id']}' deleted`
    });
  });

  test('GET /api/:workspace/projects/:id/files returns a file tree', async ({ server, auth }) => {
    const created = await createProject(server.baseUrl, auth, {
      name: 'Tree Project'
    });
    const projectId = String(created['id']);

    await fetch(`${server.baseUrl}/api/default/projects/${projectId}/folders`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: 'current-state'
      })
    });
    await fetch(`${server.baseUrl}/api/default/projects/${projectId}/files/overview.dgc`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(minimalDiagramDocument('Overview'))
    });

    const res = await fetch(`${server.baseUrl}/api/default/projects/${projectId}/files`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, Array<Record<string, unknown>>>;
    expect(body['rootFiles']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'overview.dgc'
        })
      ])
    );
    expect(body['folders']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'current-state' })
      ])
    );
  });

  test('project file routes create, read, relocate, and delete files', async ({ server, auth }) => {
    const created = await createProject(server.baseUrl, auth, {
      name: 'File Project'
    });
    const projectId = String(created['id']);

    const writeRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/files/flows/login-sequence.dgc`,
      {
        method: 'PUT',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json'
        },
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
      {
        headers: { Authorization: auth }
      }
    );

    expect(readRes.status).toBe(200);
    await expect(readRes.json()).resolves.toEqual(minimalDiagramDocument('Login Sequence'));

    const relocateRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/files/relocate/flows/login-sequence.dgc`,
      {
        method: 'PUT',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newPath: 'archive/auth-sequence.json'
        })
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
      {
        headers: { Authorization: auth }
      }
    );

    expect(relocatedReadRes.status).toBe(200);
    await expect(relocatedReadRes.json()).resolves.toEqual({
      name: 'auth-sequence',
      diagrams: []
    });

    const deleteRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/files/archive/auth-sequence.json`,
      {
        method: 'DELETE',
        headers: { Authorization: auth }
      }
    );

    expect(deleteRes.status).toBe(200);
    await expect(deleteRes.json()).resolves.toEqual({
      success: true,
      message: "File 'archive/auth-sequence.json' deleted"
    });
  });

  test('project folder routes create, rename, and delete folders', async ({ server, auth }) => {
    const created = await createProject(server.baseUrl, auth, {
      name: 'Folder Project'
    });
    const projectId = String(created['id']);

    const createFolderRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/folders`,
      {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: 'drafts'
        })
      }
    );

    expect(createFolderRes.status).toBe(200);
    await expect(createFolderRes.json()).resolves.toMatchObject({
      success: true,
      path: 'drafts'
    });

    const renameFolderRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/folders/rename`,
      {
        method: 'PUT',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          oldPath: 'drafts',
          newPath: 'review'
        })
      }
    );

    expect(renameFolderRes.status).toBe(200);
    await expect(renameFolderRes.json()).resolves.toMatchObject({
      success: true,
      count: 1
    });

    const deleteFolderRes = await fetch(
      `${server.baseUrl}/api/default/projects/${projectId}/folders/review`,
      {
        method: 'DELETE',
        headers: { Authorization: auth }
      }
    );

    expect(deleteFolderRes.status).toBe(200);
    await expect(deleteFolderRes.json()).resolves.toMatchObject({
      success: true,
      count: 1
    });
  });
});

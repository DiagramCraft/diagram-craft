import { test as baseTest, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';

const now = new Date();

// Extend with a file-scoped fixture that seeds projects and template files
const test = baseTest.extend<{ seeded: { projectId: string; wsProjectId: string } }>({
  seeded: [
    async ({ server }, use) => {
      // Project A — has a project-level template and a workspace template
      const projectA = await server.db.project.createProject({
        id: 'e2e-tmpl-proj-a',
        workspace: seedIds.workspace.default,
        name: 'Template Project A',
        description: '',
        owner: null,
        status: 'active',
        color: null,
        target_date: null,
        pinned: false,
        created_at: now,
        updated_at: now
      });

      // Project B — has only a project-level template (no workspace templates)
      const projectB = await server.db.project.createProject({
        id: 'e2e-tmpl-proj-b',
        workspace: seedIds.workspace.default,
        name: 'Template Project B',
        description: '',
        owner: null,
        status: 'active',
        color: null,
        target_date: null,
        pinned: false,
        created_at: now,
        updated_at: now
      });

      // Workspace template in project A
      const wsTemplateFile = await server.db.project.upsertProjectFile({
        workspace: seedIds.workspace.default,
        project_id: projectA.id,
        path: 'diagrams/ws-template.json',
        name: 'Workspace Template',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });
      await server.db.project.updateProjectFileTemplateStatus(
        seedIds.workspace.default, projectA.id, wsTemplateFile.id, true, true, now
      );

      // Project-level template in project A
      const projATemplateFile = await server.db.project.upsertProjectFile({
        workspace: seedIds.workspace.default,
        project_id: projectA.id,
        path: 'diagrams/proj-a-template.json',
        name: 'Project A Template',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });
      await server.db.project.updateProjectFileTemplateStatus(
        seedIds.workspace.default, projectA.id, projATemplateFile.id, true, false, now
      );

      // Plain (non-template) file in project A
      await server.db.project.upsertProjectFile({
        workspace: seedIds.workspace.default,
        project_id: projectA.id,
        path: 'diagrams/plain.json',
        name: 'Plain File',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      // Project-level template in project B
      const projBTemplateFile = await server.db.project.upsertProjectFile({
        workspace: seedIds.workspace.default,
        project_id: projectB.id,
        path: 'diagrams/proj-b-template.json',
        name: 'Project B Template',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });
      await server.db.project.updateProjectFileTemplateStatus(
        seedIds.workspace.default, projectB.id, projBTemplateFile.id, true, false, now
      );

      await use({ projectId: projectA.id, wsProjectId: projectA.id });
    },
    { scope: 'file' }
  ]
});

test.describe('GET /api/:workspace/templates', () => {
  test('returns 200 with workspaceTemplates and projectTemplates', async ({ orpc, seeded: _ }) => {
    const body = await orpc.templates.listAll({ params: { workspace: 'default' } });
    expect(Array.isArray(body.workspaceTemplates)).toBe(true);
    expect(typeof body.projectTemplates).toBe('object');
  });

  test('workspace templates are in workspaceTemplates array', async ({ orpc, seeded: _ }) => {
    const body = await orpc.templates.listAll({ params: { workspace: 'default' } });
    expect(body.workspaceTemplates.length).toBeGreaterThanOrEqual(1);
    expect(body.workspaceTemplates.every(t => t.is_workspace_template === true)).toBe(true);
  });

  test('project-level templates appear under their project id', async ({ orpc, seeded }) => {
    const body = await orpc.templates.listAll({ params: { workspace: 'default' } });
    const projTemplates = body.projectTemplates[seeded.projectId] ?? [];
    expect(projTemplates.length).toBeGreaterThanOrEqual(1);
    expect(projTemplates.every(t => t.is_template && !t.is_workspace_template)).toBe(true);
  });

  test('returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.templates.listAll({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('returns 404 for unknown workspace', async ({ orpc }) => {
    await expect(
      orpc.templates.listAll({ params: { workspace: 'nonexistent' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

test.describe('GET /api/:workspace/projects/:projectId/templates', () => {
  test('returns 200 with workspaceTemplates and projectTemplates arrays', async ({ orpc, seeded }) => {
    const body = await orpc.templates.listForProject({
      params: { workspace: 'default', id: seeded.projectId }
    });
    expect(Array.isArray(body.workspaceTemplates)).toBe(true);
    expect(Array.isArray(body.projectTemplates)).toBe(true);
  });

  test('workspaceTemplates includes templates from other projects', async ({ orpc, seeded: _ }) => {
    // Project A has the workspace template — when viewing project B, we should still see it
    const body = await orpc.templates.listForProject({
      params: { workspace: 'default', id: 'e2e-tmpl-proj-b' }
    });
    expect(body.workspaceTemplates.length).toBeGreaterThanOrEqual(1);
    expect(body.workspaceTemplates.every(t => t.is_workspace_template === true)).toBe(true);
  });

  test('projectTemplates only includes templates belonging to the target project', async ({ orpc, seeded }) => {
    const body = await orpc.templates.listForProject({
      params: { workspace: 'default', id: seeded.projectId }
    });
    expect(body.projectTemplates.length).toBeGreaterThanOrEqual(1);
    expect(body.projectTemplates.every(t => t.is_template && !t.is_workspace_template)).toBe(true);
  });

  test('returns 404 for unknown project', async ({ orpc, seeded: _ }) => {
    await expect(
      orpc.templates.listForProject({ params: { workspace: 'default', id: 'nonexistent' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('returns 401 without auth', async ({ server, seeded: _ }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.templates.listForProject({ params: { workspace: 'default', id: 'e2e-tmpl-proj-a' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('returns 404 for unknown workspace', async ({ orpc, seeded: _ }) => {
    await expect(
      orpc.templates.listForProject({ params: { workspace: 'nonexistent', id: 'any' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

test.describe('PUT /api/:workspace/projects/:projectId/template-status/:path', () => {
  test('marks a file as a project template and returns updated file', async ({ server, auth, seeded }) => {
    const path = 'diagrams/plain.json';
    const res = await fetch(
      `${server.baseUrl}/api/default/projects/${seeded.projectId}/template-status/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_template: true, is_workspace_template: false })
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { is_template: boolean; is_workspace_template: boolean };
    expect(body.is_template).toBe(true);
    expect(body.is_workspace_template).toBe(false);
  });

  test('marks a file as a workspace template', async ({ server, auth, seeded }) => {
    const path = 'diagrams/plain.json';
    const res = await fetch(
      `${server.baseUrl}/api/default/projects/${seeded.projectId}/template-status/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_template: true, is_workspace_template: true })
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { is_workspace_template: boolean };
    expect(body.is_workspace_template).toBe(true);
  });

  test('returns 400 when body is missing', async ({ server, auth, seeded }) => {
    const res = await fetch(
      `${server.baseUrl}/api/default/projects/${seeded.projectId}/template-status/diagrams%2Fplain.json`,
      { method: 'PUT', headers: { Authorization: auth } }
    );
    expect(res.status).toBe(400);
  });

  test('returns 400 when is_template is not boolean', async ({ server, auth, seeded }) => {
    const res = await fetch(
      `${server.baseUrl}/api/default/projects/${seeded.projectId}/template-status/diagrams%2Fplain.json`,
      {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_template: 'yes', is_workspace_template: false })
      }
    );
    expect(res.status).toBe(400);
  });

  test('returns 404 when file does not exist', async ({ server, auth, seeded }) => {
    const res = await fetch(
      `${server.baseUrl}/api/default/projects/${seeded.projectId}/template-status/diagrams%2Fnonexistent.json`,
      {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_template: true, is_workspace_template: false })
      }
    );
    expect(res.status).toBe(404);
  });

  test('returns 404 when project does not exist', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(
      `${server.baseUrl}/api/default/projects/nonexistent/template-status/diagrams%2Ffile.json`,
      {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_template: true, is_workspace_template: false })
      }
    );
    expect(res.status).toBe(404);
  });

  test('returns 401 without auth', async ({ server, seeded }) => {
    const res = await fetch(
      `${server.baseUrl}/api/default/projects/${seeded.projectId}/template-status/diagrams%2Fplain.json`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_template: true, is_workspace_template: false })
      }
    );
    expect(res.status).toBe(401);
  });
});

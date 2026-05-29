import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { FilesystemStorage } from './storage/fs.js';
import type { DatabaseAdapter } from './db/database.js';
import { SqliteDatabase } from './db/sqliteDatabase.js';
import { generateAccessToken } from './utils/jwt.js';

import {
  seedEntities,
  seedLifecycleStates,
  seedOwners,
  seedProjects,
  seedProjectFiles,
  seedSchemas,
  seedWorkspaces
} from './db/seedData.js';

const seedDb = async (db: DatabaseAdapter) => {
  await db.core.reset();
  for (const workspace of seedWorkspaces) {
    await db.workspaceAdmin.createWorkspace(workspace);
  }
  for (const workspace of seedWorkspaces) {
    await db.workspaceAdmin.replaceLifecycleStates(
      workspace.id,
      seedLifecycleStates.filter(state => state.workspace === workspace.id)
    );
    await db.workspaceAdmin.replaceOwners(
      workspace.id,
      seedOwners.filter(owner => owner.workspace === workspace.id)
    );
  }
  for (const schema of seedSchemas) {
    await db.catalog.createSchema(schema);
  }
  for (const entity of seedEntities) {
    await db.catalog.createEntity(entity);
  }
  for (const project of seedProjects) {
    await db.projectsFiles.createProject(project);
  }
  for (const file of seedProjectFiles) {
    await db.projectsFiles.upsertProjectFile({
      workspace: file.workspace,
      project_id: file.project_id,
      path: file.path,
      name: file.name,
      size_bytes: file.size_bytes,
      created_atIfNew: file.created_at,
      updated_at: file.updated_at
    });
  }
};

type WorkspaceSummary = { id: string };
type SchemaResponse = { id: string };
type EntityResponse = { _uid: string; _slug: string; runtime?: string };
type RelationsResponse = { outgoing: unknown[] };
type TreeResponse = {
  nodes: Array<{ _name: string; _isMatch: boolean }>;
  edges: unknown[];
};
type AuditEntry = { entity_name?: string };
type ProjectResponse = { id: string };
type FolderResponse = { count: number };
type FileListingResponse = { folders: Array<{ path: string }> };
type SearchResponse = {
  projects: Array<{ id: string }>;
  files: Array<{ projectId: string }>;
  entities: unknown[];
};
type AuditStatsResponse = { total: number };

describe('arch-register sqlite integration', () => {
  let db: DatabaseAdapter;
  let sqliteDir = '';
  let storageDir = '';
  let app: ReturnType<typeof createApp>;
  let testUserToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = '12345678901234567890123456789012';

    sqliteDir = await mkdtemp(join(tmpdir(), 'arch-register-sqlite-'));
    db = new SqliteDatabase(join(sqliteDir, 'db.sqlite'));
    storageDir = await mkdtemp(join(tmpdir(), 'arch-register-storage-'));
    app = createApp(db, new FilesystemStorage(storageDir));
  }, 30000);

  beforeEach(async () => {
    await seedDb(db);
    await rm(storageDir, { recursive: true, force: true });

    const testUser = await db.identityAuth.createUser({
      id: 'test-admin',
      email: 'test@example.com',
      display_name: 'Test Admin',
      auth_provider: 'local',
      password_hash: 'hash',
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: null
    });
    await db.identityAuth.replaceGlobalRoleAssignments(
      testUser.id,
      ['platform_admin'],
      new Date()
    );
    testUserToken = generateAccessToken(testUser);
  }, 30000);

  afterAll(async () => {
    await db.core.close();
    await rm(storageDir, { recursive: true, force: true });
    await rm(sqliteDir, { recursive: true, force: true });
    delete process.env.JWT_SECRET;
  });

  const json = async <T>(path: string, init?: RequestInit): Promise<{ response: Response; body: T }> => {
    const headers = new Headers(init?.headers);
    if (!headers.has('authorization')) {
      headers.set('authorization', `Bearer ${testUserToken}`);
    }
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    const response = await app.request(path, {
      ...init,
      headers,
      signal: AbortSignal.timeout(5000)
    });
    const body = (await response.json()) as T;
    return { response, body };
  };

  const text = async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (!headers.has('authorization')) {
      headers.set('authorization', `Bearer ${testUserToken}`);
    }

    const response = await app.request(path, {
      ...init,
      headers,
      signal: AbortSignal.timeout(5000)
    });
    return { response, body: await response.text() };
  };

  const authHeaders = (token: string) => ({
    authorization: `Bearer ${token}`,
    'content-type': 'application/json'
  });

  it('supports workspace config CRUD', async () => {
    const { body: workspaces } = await json<WorkspaceSummary[]>('/api/workspaces');
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toBeDefined();
    expect(workspaces[0]!.id).toBe('default');

    const created = await json<WorkspaceSummary>('/api/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Platform Architecture', description: 'New workspace' })
    });
    expect(created.response.status).toBe(200);
    expect(created.body.id).toBe('platform-architecture');

    const lifecycle = await json<WorkspaceSummary[]>(
      '/api/platform-architecture/config/lifecycle-states'
    );
    expect(lifecycle.body.map(row => row.id)).toEqual([
      'proposed',
      'experimental',
      'production',
      'deprecated'
    ]);

    const updatedOwners = await json<WorkspaceSummary[]>('/api/platform-architecture/config/owners', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([{ id: 'platform-team' }, { id: 'data-team' }])
    });
    expect(updatedOwners.response.status).toBe(200);
    expect(updatedOwners.body.map(row => row.id)).toEqual(['platform-team', 'data-team']);
  }, 20000);

  it('supports schema and entity CRUD, tree, relations, export, and audit', async () => {
    const createdSchema = await json<SchemaResponse>('/api/default/schemas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Service',
        fields: [
          { id: 'runtime', name: 'Runtime', type: 'text' },
          {
            id: 'system',
            name: 'System',
            type: 'containment',
            schemaId: '00000000-0000-0000-0000-000000000002',
            minCount: 1,
            maxCount: 1
          }
        ]
      })
    });
    expect(createdSchema.response.status).toBe(200);

    const createdEntity = await json<EntityResponse>('/api/default/data', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        _schemaId: createdSchema.body.id,
        _name: 'Billing Service',
        _owner: 'platform-team',
        _lifecycle: 'production',
        _tags: ['billing'],
        runtime: 'Node.js',
        system: '00000000-0000-0000-0002-000000000001'
      })
    });
    expect(createdEntity.response.status).toBe(200);
    expect(createdEntity.body._slug).toBe('billing-service');

    const list = await json<unknown[]>('/api/default/data?view=summary&q=billing');
    expect(list.body).toHaveLength(1);

    const relations = await json<RelationsResponse>(
      `/api/default/data/${createdEntity.body._uid}/relations`
    );
    expect(relations.body.outgoing).toHaveLength(1);

    const tree = await json<TreeResponse>('/api/default/data/tree?q=billing');
    expect(tree.body.nodes.some(node => node._name === 'Billing Service' && node._isMatch)).toBe(
      true
    );
    expect(tree.body.edges.length).toBeGreaterThanOrEqual(1);

    const exported = await text('/api/default/data/export?q=billing');
    expect(exported.response.status).toBe(200);
    expect(exported.body).toContain('Billing Service');

    const updated = await json<EntityResponse>(`/api/default/data/${createdEntity.body._uid}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        _schemaId: createdSchema.body.id,
        _name: 'Billing Service',
        _owner: 'platform-team',
        _lifecycle: 'production',
        _tags: ['billing', 'payments'],
        runtime: 'Bun',
        system: '00000000-0000-0000-0002-000000000001'
      })
    });
    expect(updated.body.runtime).toBe('Bun');

    const audit = await json<AuditEntry[]>('/api/default/audit?entityType=entity');
    expect(audit.body.length).toBeGreaterThan(0);
    expect(audit.body[0]).toBeDefined();
    expect(audit.body[0]!.entity_name).toBeDefined();
  }, 20000);

  it('supports project files, folder rename/delete, search, and project audit', async () => {
    const createdProject = await json<ProjectResponse>('/api/default/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alpha', description: 'Alpha docs', status: 'active' })
    });
    expect(createdProject.response.status).toBe(200);

    const folder = await json<unknown>(`/api/default/projects/${createdProject.body.id}/folders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'architecture' })
    });
    expect(folder.response.status).toBe(200);

    const file = await json<unknown>(
      `/api/default/projects/${createdProject.body.id}/files/architecture/system.json`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'System Diagram', version: 1 })
      }
    );
    expect(file.response.status).toBe(200);

    const renamed = await json<FolderResponse>(
      `/api/default/projects/${createdProject.body.id}/folders/rename`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oldPath: 'architecture', newPath: 'design' })
      }
    );
    expect(renamed.body.count).toBeGreaterThan(0);

    const listing = await json<FileListingResponse>(
      `/api/default/projects/${createdProject.body.id}/files`
    );
    expect(listing.body.folders[0]).toBeDefined();
    expect(listing.body.folders[0]!.path).toBe('design');

    const search = await json<SearchResponse>(
      '/api/default/search?q=system&types=projects,files,entities,schemas'
    );
    expect(search.body.projects.some(project => project.id === createdProject.body.id)).toBe(false);
    expect(
      search.body.files.some(fileResult => fileResult.projectId === createdProject.body.id)
    ).toBe(true);
    expect(search.body.entities.length).toBeGreaterThan(0);

    const deletedFolder = await json<FolderResponse>(
      `/api/default/projects/${createdProject.body.id}/folders/design`,
      {
        method: 'DELETE'
      }
    );
    expect(deletedFolder.body.count).toBeGreaterThan(0);

    const audit = await json<AuditStatsResponse>('/api/default/audit/stats');
    expect(audit.body.total).toBeGreaterThan(0);
  }, 20000);

  it('enforces restricted subtree visibility and schema admin permissions', async () => {
    const viewer = await db.identityAuth.createUser({
      id: 'viewer',
      email: 'viewer@example.com',
      display_name: 'Viewer',
      auth_provider: 'local',
      password_hash: 'hash',
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: null
    });

    const schemaAdmin = await db.identityAuth.createUser({
      id: 'schema-admin',
      email: 'schema-admin@example.com',
      display_name: 'Schema Admin',
      auth_provider: 'local',
      password_hash: 'hash',
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: null
    });

    await db.identityAuth.replaceGlobalRoleAssignments(
      schemaAdmin.id,
      ['schema_admin'],
      new Date()
    );

    const restricted = await json<EntityResponse>('/api/default/data', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        _schemaId: '00000000-0000-0000-0000-000000000001',
        _name: 'Security Domain',
        _owner: 'security-team',
        _visibilityMode: 'restricted'
      })
    });

    const viewerToken = generateAccessToken(viewer);
    const deniedRead = await app.request(`/api/default/data/${restricted.body._uid}`, {
      headers: { authorization: `Bearer ${viewerToken}` },
      signal: AbortSignal.timeout(5000)
    });
    expect(deniedRead.status).toBe(403);

    const deniedSchemaWrite = await app.request('/api/default/schemas', {
      method: 'POST',
      headers: authHeaders(viewerToken),
      body: JSON.stringify({ name: 'Forbidden Schema', fields: [] }),
      signal: AbortSignal.timeout(5000)
    });
    expect(deniedSchemaWrite.status).toBe(403);

    const schemaAdminToken = generateAccessToken(schemaAdmin);
    const allowedSchemaWrite = await app.request('/api/default/schemas', {
      method: 'POST',
      headers: authHeaders(schemaAdminToken),
      body: JSON.stringify({ name: 'Allowed Schema', fields: [] }),
      signal: AbortSignal.timeout(5000)
    });
    expect(allowedSchemaWrite.status).toBe(200);
  }, 20000);
});
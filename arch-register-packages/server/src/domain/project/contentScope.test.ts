import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { HTTPError } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import { ENTITY_SCOPE, PROJECT_SCOPE, WORKSPACE_SCOPE } from './contentScope';

const allowedAuthCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: 'admin',
  schemas: [],
  entities: [],
  grants: []
});

const deniedAuthCtx = buildAuthorizationContext({
  userId: 'user-2',
  globalRoles: [],
  workspaceRole: null,
  schemas: [],
  entities: [],
  grants: []
});

describe('PROJECT_SCOPE.resolve', () => {
  const makeDb = (project: { id: string; owner: string | null } | null) =>
    ({
      project: {
        getProject: vi.fn(async () => project),
        listContentNodes: vi.fn(async () => []),
        getContentNodeByPath: vi.fn(async () => null),
        deleteContentNodeByPath: vi.fn(async () => null),
        deleteContentNodeFolder: vi.fn(async () => []),
        renameContentNodeFolder: vi.fn(async () => [])
      }
    }) as unknown as DatabaseAdapter;

  it('throws 404 when the project does not exist', async () => {
    const db = makeDb(null);
    await expect(
      PROJECT_SCOPE.resolve(db, 'ws-1', 'missing-project', allowedAuthCtx, 'edit')
    ).rejects.toThrow(HTTPError);
  });

  it('throws 403 on edit when the caller lacks project permission', async () => {
    const db = makeDb({ id: 'project-1', owner: null });
    await expect(
      PROJECT_SCOPE.resolve(db, 'ws-1', 'project-1', deniedAuthCtx, 'edit')
    ).rejects.toThrow(HTTPError);
  });

  it('does not enforce a permission check for read actions', async () => {
    const db = makeDb({ id: 'project-1', owner: null });
    await expect(
      PROJECT_SCOPE.resolve(db, 'ws-1', 'project-1', deniedAuthCtx, 'read')
    ).resolves.toBeDefined();
  });

  it('resolves storage/project ids and audit metadata from the project', async () => {
    const db = makeDb({ id: 'project-1', owner: null });
    const scope = await PROJECT_SCOPE.resolve(db, 'ws-1', 'project-1', allowedAuthCtx, 'edit');

    expect(scope.kind).toBe('project');
    expect(scope.storageId).toBe('project-1');
    expect(scope.projectId).toBe('project-1');
    expect(scope.entityId).toBeNull();
    expect(scope.auditMetadata).toEqual({ project_id: 'project-1' });
  });

  it('delegates node operations to the project-scoped DB methods', async () => {
    const db = makeDb({ id: 'project-1', owner: null });
    const scope = await PROJECT_SCOPE.resolve(db, 'ws-1', 'project-1', allowedAuthCtx, 'edit');

    await scope.listNodes(db, 'ws-1');
    expect(db.project.listContentNodes).toHaveBeenCalledWith('ws-1', 'project-1');

    await scope.findNodeByPath(db, 'ws-1', '/a.md');
    expect(db.project.getContentNodeByPath).toHaveBeenCalledWith('ws-1', 'project-1', '/a.md');

    await scope.deleteNodeByPath(db, 'ws-1', '/a.md');
    expect(db.project.deleteContentNodeByPath).toHaveBeenCalledWith('ws-1', 'project-1', '/a.md');

    await scope.deleteNodeFolder(db, 'ws-1', '/folder');
    expect(db.project.deleteContentNodeFolder).toHaveBeenCalledWith('ws-1', 'project-1', '/folder');

    const updatedAt = new Date('2026-07-04T00:00:00.000Z');
    await scope.renameNodeFolder(db, 'ws-1', '/old', '/new', updatedAt);
    expect(db.project.renameContentNodeFolder).toHaveBeenCalledWith(
      'ws-1',
      'project-1',
      '/old',
      '/new',
      updatedAt
    );
  });
});

describe('ENTITY_SCOPE.resolve', () => {
  const makeDb = (entity: { id: string } | null, nodes: { path: string }[] = []) =>
    ({
      catalog: {
        getEntity: vi.fn(async () => entity)
      },
      project: {
        listEntityContentNodes: vi.fn(async () => nodes),
        deleteEntityContentNodeByPath: vi.fn(async () => null),
        deleteEntityContentNodeFolder: vi.fn(async () => []),
        renameEntityContentNodeFolder: vi.fn(async () => [])
      }
    }) as unknown as DatabaseAdapter;

  it('throws 404 when the entity does not exist', async () => {
    const db = makeDb(null);
    await expect(
      ENTITY_SCOPE.resolve(db, 'ws-1', 'missing-entity', allowedAuthCtx, 'edit')
    ).rejects.toThrow(HTTPError);
  });

  it('requires content.edit for edit actions', async () => {
    const db = makeDb({ id: 'entity-1' });
    await expect(
      ENTITY_SCOPE.resolve(db, 'ws-1', 'entity-1', deniedAuthCtx, 'edit')
    ).rejects.toThrow(HTTPError);
  });

  it('requires content.view for read actions', async () => {
    const db = makeDb({ id: 'entity-1' });
    await expect(
      ENTITY_SCOPE.resolve(db, 'ws-1', 'entity-1', deniedAuthCtx, 'read')
    ).rejects.toThrow(HTTPError);
    await expect(
      ENTITY_SCOPE.resolve(db, 'ws-1', 'entity-1', allowedAuthCtx, 'read')
    ).resolves.toBeDefined();
  });

  it('resolves storage/entity ids and audit metadata from the entity', async () => {
    const db = makeDb({ id: 'entity-1' });
    const scope = await ENTITY_SCOPE.resolve(db, 'ws-1', 'entity-1', allowedAuthCtx, 'edit');

    expect(scope.kind).toBe('entity');
    expect(scope.storageId).toBe('entity-1');
    expect(scope.projectId).toBeNull();
    expect(scope.entityId).toBe('entity-1');
    expect(scope.auditMetadata).toEqual({ entity_id: 'entity-1' });
  });

  it('finds a node by path via a list+find over entity content nodes', async () => {
    const db = makeDb({ id: 'entity-1' }, [{ path: '/a.md' }, { path: '/b.md' }]);
    const scope = await ENTITY_SCOPE.resolve(db, 'ws-1', 'entity-1', allowedAuthCtx, 'edit');

    const found = await scope.findNodeByPath(db, 'ws-1', '/b.md');
    expect(found).toEqual({ path: '/b.md' });
    expect(db.project.listEntityContentNodes).toHaveBeenCalledWith('ws-1', 'entity-1');

    const missing = await scope.findNodeByPath(db, 'ws-1', '/missing.md');
    expect(missing).toBeNull();
  });

  it('delegates delete/rename operations to the entity-scoped DB methods', async () => {
    const db = makeDb({ id: 'entity-1' });
    const scope = await ENTITY_SCOPE.resolve(db, 'ws-1', 'entity-1', allowedAuthCtx, 'edit');

    await scope.deleteNodeByPath(db, 'ws-1', '/a.md');
    expect(db.project.deleteEntityContentNodeByPath).toHaveBeenCalledWith(
      'ws-1',
      'entity-1',
      '/a.md'
    );

    await scope.deleteNodeFolder(db, 'ws-1', '/folder');
    expect(db.project.deleteEntityContentNodeFolder).toHaveBeenCalledWith(
      'ws-1',
      'entity-1',
      '/folder'
    );

    const updatedAt = new Date('2026-07-04T00:00:00.000Z');
    await scope.renameNodeFolder(db, 'ws-1', '/old', '/new', updatedAt);
    expect(db.project.renameEntityContentNodeFolder).toHaveBeenCalledWith(
      'ws-1',
      'entity-1',
      '/old',
      '/new',
      updatedAt
    );
  });
});

describe('WORKSPACE_SCOPE.resolve', () => {
  const makeDb = (nodes: { path: string }[] = []) =>
    ({
      project: {
        listWorkspaceContentNodes: vi.fn(async () => nodes),
        deleteWorkspaceContentNodeByPath: vi.fn(async () => null),
        deleteWorkspaceContentNodeFolder: vi.fn(async () => []),
        renameWorkspaceContentNodeFolder: vi.fn(async () => [])
      }
    }) as unknown as DatabaseAdapter;

  it('requires content.edit for edit actions', async () => {
    const db = makeDb();
    await expect(
      WORKSPACE_SCOPE.resolve(db, 'ws-1', undefined, deniedAuthCtx, 'edit')
    ).rejects.toThrow(HTTPError);
  });

  it('requires content.view for read actions', async () => {
    const db = makeDb();
    await expect(
      WORKSPACE_SCOPE.resolve(db, 'ws-1', undefined, deniedAuthCtx, 'read')
    ).rejects.toThrow(HTTPError);
    await expect(
      WORKSPACE_SCOPE.resolve(db, 'ws-1', undefined, allowedAuthCtx, 'read')
    ).resolves.toBeDefined();
  });

  it('resolves the workspace itself as storage id, with no project/entity id', async () => {
    const db = makeDb();
    const scope = await WORKSPACE_SCOPE.resolve(db, 'ws-1', undefined, allowedAuthCtx, 'edit');

    expect(scope.kind).toBe('workspace');
    expect(scope.storageId).toBe('ws-1');
    expect(scope.projectId).toBeNull();
    expect(scope.entityId).toBeNull();
    expect(scope.auditMetadata).toEqual({});
  });

  it('finds a node by path via a list+find over workspace content nodes', async () => {
    const db = makeDb([{ path: '/a.md' }]);
    const scope = await WORKSPACE_SCOPE.resolve(db, 'ws-1', undefined, allowedAuthCtx, 'edit');

    const found = await scope.findNodeByPath(db, 'ws-1', '/a.md');
    expect(found).toEqual({ path: '/a.md' });
    expect(db.project.listWorkspaceContentNodes).toHaveBeenCalledWith('ws-1');
  });

  it('delegates delete/rename operations to the workspace-scoped DB methods', async () => {
    const db = makeDb();
    const scope = await WORKSPACE_SCOPE.resolve(db, 'ws-1', undefined, allowedAuthCtx, 'edit');

    await scope.deleteNodeByPath(db, 'ws-1', '/a.md');
    expect(db.project.deleteWorkspaceContentNodeByPath).toHaveBeenCalledWith('ws-1', '/a.md');

    await scope.deleteNodeFolder(db, 'ws-1', '/folder');
    expect(db.project.deleteWorkspaceContentNodeFolder).toHaveBeenCalledWith('ws-1', '/folder');

    const updatedAt = new Date('2026-07-04T00:00:00.000Z');
    await scope.renameNodeFolder(db, 'ws-1', '/old', '/new', updatedAt);
    expect(db.project.renameWorkspaceContentNodeFolder).toHaveBeenCalledWith(
      'ws-1',
      '/old',
      '/new',
      updatedAt
    );
  });
});

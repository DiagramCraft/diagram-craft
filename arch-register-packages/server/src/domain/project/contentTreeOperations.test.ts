import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage.types';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { ENTITY_SCOPE, PROJECT_SCOPE, WORKSPACE_SCOPE } from './contentScope';
import { deleteContentFolder, renameContentFolder } from './contentTreeOperations';

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({
    userId: 'user-1',
    globalPermissions: new Set(['admin_platform']),
    workspaceRole: null,
    workspaceRoles: new Map(),
    teamRolesByTeam: new Map(),
    schemas: new Map(),
    entities: new Map(),
    grants: []
  })),
  requireProjectAction: vi.fn(),
  requireWorkspaceCapability: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

vi.mock('../audit/db/auditLogging', () => ({
  logAudit: vi.fn(async () => {}),
  writeAudit: vi.fn(async () => {}),
  extractEntityFields: vi.fn((value: unknown) => value)
}));

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const nodes = [
  { id: 'node-1', name: 'docs', path: '/docs', type: 'folder' },
  { id: 'node-2', name: 'page.md', path: '/docs/page.md', type: 'markdown' }
];

type ScopeCase = {
  name: string;
  scope: typeof PROJECT_SCOPE | typeof ENTITY_SCOPE | typeof WORKSPACE_SCOPE;
  identifier: string | undefined;
  makeDb: () => DatabaseAdapter;
  deleteFolderMock: (db: DatabaseAdapter) => ReturnType<typeof vi.fn>;
  expectedDeleteFolderArgs: unknown[];
};

const cases: ScopeCase[] = [
  {
    name: 'project',
    scope: PROJECT_SCOPE,
    identifier: 'project-1',
    makeDb: () =>
      ({
        project: {
          getProject: vi.fn(async () => ({ id: 'project-1', owner: null })),
          listContentNodes: vi.fn(async () => nodes),
          deleteContentNodeFolder: vi.fn(async () => nodes)
        }
      }) as unknown as DatabaseAdapter,
    deleteFolderMock: db => db.project.deleteContentNodeFolder as ReturnType<typeof vi.fn>,
    expectedDeleteFolderArgs: ['ws-1', 'project-1', '/docs']
  },
  {
    name: 'entity',
    scope: ENTITY_SCOPE,
    identifier: 'entity-1',
    makeDb: () =>
      ({
        catalog: {
          getEntity: vi.fn(async () => ({ id: 'entity-1' }))
        },
        project: {
          deleteEntityContentNodeFolder: vi.fn(async () => nodes),
          listEntityContentNodes: vi.fn(async () => nodes)
        }
      }) as unknown as DatabaseAdapter,
    deleteFolderMock: db => db.project.deleteEntityContentNodeFolder as ReturnType<typeof vi.fn>,
    expectedDeleteFolderArgs: ['ws-1', 'entity-1', '/docs']
  },
  {
    name: 'workspace',
    scope: WORKSPACE_SCOPE,
    identifier: undefined,
    makeDb: () =>
      ({
        project: {
          listWorkspaceContentNodes: vi.fn(async () => nodes),
          deleteWorkspaceContentNodeFolder: vi.fn(async () => nodes)
        }
      }) as unknown as DatabaseAdapter,
    deleteFolderMock: db => db.project.deleteWorkspaceContentNodeFolder as ReturnType<typeof vi.fn>,
    expectedDeleteFolderArgs: ['ws-1', '/docs']
  }
];

describe.each(cases)('deleteContentFolder ($name scope)', ({
  scope,
  identifier,
  makeDb,
  deleteFolderMock,
  expectedDeleteFolderArgs
}) => {
  it('deletes matching content nodes, their storage blobs, and logs an audit entry', async () => {
    const db = makeDb();
    const storage = {
      delete: vi.fn(async () => {}),
      stageDelete: vi.fn(async (workspace: string, storageId: string, nodeId: string) => ({
        commit: () => storage.delete(workspace, storageId, nodeId),
        rollback: async () => {},
        finalize: async () => {}
      }))
    } as unknown as StorageAdapter;

    const result = await deleteContentFolder(
      scope,
      db,
      storage,
      'ws-1',
      identifier,
      '/docs',
      event
    );

    expect(result).toEqual({ success: true, count: 2 });
    expect(deleteFolderMock(db)).toHaveBeenCalledWith(...expectedDeleteFolderArgs);
    expect(storage.delete).toHaveBeenCalledTimes(1);

    const { writeAudit } = await import('../audit/db/auditLogging');
    expect(writeAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        operation: 'delete',
        entityType: 'content_node',
        entityName: '/docs',
        changes: { old: { path: '/docs', type: 'folder' } }
      })
    );
  });

  it('returns a 404 when no content nodes are found under the folder', async () => {
    const db = makeDb();
    (deleteFolderMock(db) as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const storage = { delete: vi.fn(async () => {}) } as unknown as StorageAdapter;

    await expect(
      deleteContentFolder(scope, db, storage, 'ws-1', identifier, '/missing', event)
    ).rejects.toThrow(/No files found under folder/);
  });
});

type RenameScopeCase = {
  name: string;
  scope: typeof PROJECT_SCOPE | typeof ENTITY_SCOPE | typeof WORKSPACE_SCOPE;
  identifier: string | undefined;
  makeDb: () => DatabaseAdapter;
  renameFolderMock: (db: DatabaseAdapter) => ReturnType<typeof vi.fn>;
  expectedRenameFolderArgs: unknown[];
};

const renameCases: RenameScopeCase[] = [
  {
    name: 'project',
    scope: PROJECT_SCOPE,
    identifier: 'project-1',
    makeDb: () =>
      ({
        project: {
          getProject: vi.fn(async () => ({ id: 'project-1', owner: null })),
          renameContentNodeFolder: vi.fn(async () => ['a', 'b'])
        }
      }) as unknown as DatabaseAdapter,
    renameFolderMock: db => db.project.renameContentNodeFolder as ReturnType<typeof vi.fn>,
    expectedRenameFolderArgs: ['ws-1', 'project-1', '/old', '/new']
  },
  {
    name: 'entity',
    scope: ENTITY_SCOPE,
    identifier: 'entity-1',
    makeDb: () =>
      ({
        catalog: {
          getEntity: vi.fn(async () => ({ id: 'entity-1' }))
        },
        project: {
          renameEntityContentNodeFolder: vi.fn(async () => ['a', 'b'])
        }
      }) as unknown as DatabaseAdapter,
    renameFolderMock: db => db.project.renameEntityContentNodeFolder as ReturnType<typeof vi.fn>,
    expectedRenameFolderArgs: ['ws-1', 'entity-1', '/old', '/new']
  },
  {
    name: 'workspace',
    scope: WORKSPACE_SCOPE,
    identifier: undefined,
    makeDb: () =>
      ({
        project: {
          renameWorkspaceContentNodeFolder: vi.fn(async () => ['a', 'b'])
        }
      }) as unknown as DatabaseAdapter,
    renameFolderMock: db => db.project.renameWorkspaceContentNodeFolder as ReturnType<typeof vi.fn>,
    expectedRenameFolderArgs: ['ws-1', '/old', '/new']
  }
];

describe.each(renameCases)('renameContentFolder ($name scope)', ({
  scope,
  identifier,
  makeDb,
  renameFolderMock,
  expectedRenameFolderArgs
}) => {
  it('renames matching content nodes and logs an audit entry', async () => {
    const db = makeDb();

    const result = await renameContentFolder(scope, db, 'ws-1', identifier, '/old', '/new', event);

    expect(result).toEqual({ success: true, message: 'Renamed 2 file(s)', count: 2 });
    expect(renameFolderMock(db)).toHaveBeenCalledWith(
      ...expectedRenameFolderArgs,
      expect.any(Date)
    );

    const { writeAudit } = await import('../audit/db/auditLogging');
    expect(writeAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        operation: 'update',
        entityType: 'content_node',
        entityName: '/new',
        changes: { old: { path: '/old' }, new: { path: '/new' } },
        metadata: expect.objectContaining({ operation: 'rename_folder' })
      })
    );
  });

  it('returns a 404 when no content nodes are found under the old path', async () => {
    const db = makeDb();
    (renameFolderMock(db) as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await expect(
      renameContentFolder(scope, db, 'ws-1', identifier, '/missing', '/new', event)
    ).rejects.toThrow(/No files found under folder/);
  });
});

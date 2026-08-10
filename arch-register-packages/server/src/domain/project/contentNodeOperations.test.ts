import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { ContentNodeDbResult } from './db/projectDatabase';
import {
  createScopedFolder,
  listEntityContentNodes,
  listProjectFiles,
  listWorkspaceContentNodes
} from './contentNodeOperations';
import { ENTITY_SCOPE, PROJECT_SCOPE, WORKSPACE_SCOPE } from './contentScope';

const { requireWorkspaceCapability, logAudit } = vi.hoisted(() => ({
  requireWorkspaceCapability: vi.fn(),
  logAudit: vi.fn(async () => undefined)
}));

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
  requireProjectAccess: vi.fn(),
  requireProjectAction: vi.fn(),
  requireWorkspaceAdmin: vi.fn(),
  requireWorkspaceCapability
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../audit/db/auditLogging', () => ({
  logAudit,
  writeAudit: vi.fn(async () => undefined),
  extractEntityFields: vi.fn((value: unknown) => value)
}));

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;
const now = new Date('2026-08-10T00:00:00.000Z');

const makeNode = (
  overrides: Partial<ContentNodeDbResult> & Pick<ContentNodeDbResult, 'id' | 'path' | 'name'>
): ContentNodeDbResult => {
  const { id, path, name, ...rest } = overrides;
  return {
    workspace: 'ws-1',
    project_id: 'project-1',
    entity_id: null,
    parent_id: null,
    id,
    path,
    name,
    role: null,
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: 'user-1',
    updated_by: 'user-1',
    mime_type: null,
    original_filename: null,
    mount_id: null,
    metadata_title: null,
    metadata_description: null,
    metadata_company: null,
    metadata_category: null,
    metadata_keywords: [],
    document_type_icon: null,
    ...rest
  };
};

type ScopeCase = {
  name: string;
  scope: typeof PROJECT_SCOPE | typeof ENTITY_SCOPE | typeof WORKSPACE_SCOPE;
  identifier: string | undefined;
  listMethod: 'listContentNodes' | 'listEntityContentNodes' | 'listWorkspaceContentNodes';
  makeDb: (nodes: ContentNodeDbResult[], created: ContentNodeDbResult) => DatabaseAdapter;
  expectedFields: { project_id: string | null; entity_id: string | null };
  expectedAuditMetadata: Record<string, string>;
};

const cases: ScopeCase[] = [
  {
    name: 'project',
    scope: PROJECT_SCOPE,
    identifier: 'project-public',
    listMethod: 'listContentNodes',
    makeDb: (nodes, created) =>
      ({
        project: {
          getProject: vi.fn(async () => ({
            id: 'project-1',
            public_id: 'project-public',
            owner: null
          })),
          listContentNodes: vi.fn(async () => nodes),
          createContentNodeIfAbsent: vi.fn(async () => created)
        }
      }) as unknown as DatabaseAdapter,
    expectedFields: { project_id: 'project-1', entity_id: null },
    expectedAuditMetadata: { project_id: 'project-1' }
  },
  {
    name: 'entity',
    scope: ENTITY_SCOPE,
    identifier: 'entity-1',
    listMethod: 'listEntityContentNodes',
    makeDb: (nodes, created) =>
      ({
        catalog: { getEntity: vi.fn(async () => ({ id: 'entity-1' })) },
        project: {
          listEntityContentNodes: vi.fn(async () => nodes),
          createContentNodeIfAbsent: vi.fn(async () => created)
        }
      }) as unknown as DatabaseAdapter,
    expectedFields: { project_id: null, entity_id: 'entity-1' },
    expectedAuditMetadata: { entity_id: 'entity-1' }
  },
  {
    name: 'workspace',
    scope: WORKSPACE_SCOPE,
    identifier: undefined,
    listMethod: 'listWorkspaceContentNodes',
    makeDb: (nodes, created) =>
      ({
        project: {
          listWorkspaceContentNodes: vi.fn(async () => nodes),
          createContentNodeIfAbsent: vi.fn(async () => created)
        }
      }) as unknown as DatabaseAdapter,
    expectedFields: { project_id: null, entity_id: null },
    expectedAuditMetadata: {}
  }
];

describe.each(cases)('scope-neutral content node operations ($name)', scopeCase => {
  beforeEach(() => {
    logAudit.mockClear();
    requireWorkspaceCapability.mockClear();
  });

  it('lists nodes through the scope adapter and builds one file tree', async () => {
    const folder = makeNode({ id: 'folder-1', path: 'docs', name: 'docs', type: 'folder' });
    const file = makeNode({
      id: 'file-1',
      path: 'docs/overview.json',
      name: 'Overview',
      type: 'diagram',
      parent_id: folder.id,
      ...scopeCase.expectedFields
    });
    const db = scopeCase.makeDb([folder, file], folder);

    const result =
      scopeCase.name === 'project'
        ? await listProjectFiles(db, 'ws-1', scopeCase.identifier!, event)
        : scopeCase.name === 'entity'
          ? await listEntityContentNodes(db, 'ws-1', scopeCase.identifier!, event)
          : await listWorkspaceContentNodes(db, 'ws-1', event);

    expect(result.folders).toEqual([
      expect.objectContaining({ path: 'docs', files: [expect.objectContaining({ id: 'file-1' })] })
    ]);
    expect(
      (db.project as unknown as Record<string, ReturnType<typeof vi.fn>>)[scopeCase.listMethod]
    ).toHaveBeenCalled();
  });

  it('creates a folder with shared name, parent, scope fields, and audit mechanics', async () => {
    const parent = makeNode({ id: 'parent-1', path: 'docs', name: 'docs', type: 'folder' });
    const created = makeNode({
      id: 'folder-2',
      path: 'docs/reviews',
      name: 'reviews',
      type: 'folder',
      ...scopeCase.expectedFields,
      parent_id: parent.id
    });
    const db = scopeCase.makeDb([parent], created);

    const result = await createScopedFolder(
      scopeCase.scope,
      db,
      'ws-1',
      scopeCase.identifier,
      'docs/reviews',
      event,
      'Failed to create test folder'
    );

    expect(result).toMatchObject({ success: true, path: 'docs/reviews' });
    expect(db.project.createContentNodeIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: 'ws-1',
        ...scopeCase.expectedFields,
        parent_id: 'parent-1',
        path: 'docs/reviews',
        name: 'reviews',
        type: 'folder'
      })
    );
    expect(logAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        metadata: { ...scopeCase.expectedAuditMetadata, path: 'docs/reviews', is_folder: true }
      })
    );
  });
});

describe('createScopedFolder mounted content protection', () => {
  it('rejects a folder below a mounted node before writing', async () => {
    const nodes = [
      makeNode({
        id: 'mount-1',
        path: 'external',
        name: 'external',
        type: 'folder',
        mount_id: 'mount-1'
      })
    ];
    const createContentNodeIfAbsent = vi.fn();
    const db = {
      project: {
        listWorkspaceContentNodes: vi.fn(async () => nodes),
        createContentNodeIfAbsent
      }
    } as unknown as DatabaseAdapter;

    await expect(
      createScopedFolder(
        WORKSPACE_SCOPE,
        db,
        'ws-1',
        undefined,
        'external/new',
        event,
        'Failed to create test folder'
      )
    ).rejects.toThrow();
    expect(createContentNodeIfAbsent).not.toHaveBeenCalled();
  });
});

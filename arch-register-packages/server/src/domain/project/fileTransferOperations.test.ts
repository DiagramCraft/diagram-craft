import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { ContentNodeDbResult } from './db/projectDatabase';
import { downloadContentFile } from './fileTransferOperations';
import { ENTITY_SCOPE, PROJECT_SCOPE, WORKSPACE_SCOPE } from './contentScope';

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
  requireProjectAccess: vi.fn(),
  requireProjectAction: vi.fn(),
  requireWorkspaceAdmin: vi.fn(),
  requireWorkspaceCapability: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const makeFile = (scope: 'project' | 'entity' | 'workspace'): ContentNodeDbResult => ({
  id: `${scope}-file`,
  workspace: 'ws-1',
  project_id: scope === 'project' ? 'project-1' : null,
  entity_id: scope === 'entity' ? 'entity-1' : null,
  parent_id: null,
  path: 'docs/readme.txt',
  name: 'readme.txt',
  role: null,
  type: 'file',
  size_bytes: 7,
  comment_count: 0,
  unresolved_comment_count: 0,
  is_template: false,
  is_workspace_template: false,
  preview_svg: null,
  created_at: new Date('2026-08-10T00:00:00.000Z'),
  updated_at: new Date('2026-08-10T00:00:00.000Z'),
  created_by: 'user-1',
  updated_by: 'user-1',
  mime_type: 'text/plain',
  original_filename: 'readme.txt',
  mount_id: null,
  metadata_title: null,
  metadata_description: null,
  metadata_company: null,
  metadata_category: null,
  metadata_keywords: [],
  document_type_icon: null
});

type ScopeCase = {
  name: string;
  scope: typeof PROJECT_SCOPE | typeof ENTITY_SCOPE | typeof WORKSPACE_SCOPE;
  identifier: string | undefined;
  storageId: string;
  makeDb: (file: ContentNodeDbResult) => DatabaseAdapter;
};

const cases: ScopeCase[] = [
  {
    name: 'project',
    scope: PROJECT_SCOPE,
    identifier: 'project-public',
    storageId: 'project-1',
    makeDb: file =>
      ({
        project: {
          projects: {
            getProject: vi.fn(async () => ({
              id: 'project-1',
              public_id: 'project-public',
              owner: null
            }))
          },
          contentNodes: {
            getContentNodeByPath: vi.fn(async () => file)
          }
        }
      }) as unknown as DatabaseAdapter
  },
  {
    name: 'entity',
    scope: ENTITY_SCOPE,
    identifier: 'entity-1',
    storageId: 'entity-1',
    makeDb: file =>
      ({
        catalog: { getEntity: vi.fn(async () => ({ id: 'entity-1' })) },
        project: {
          contentNodes: {
            listEntityContentNodes: vi.fn(async () => [file])
          }
        }
      }) as unknown as DatabaseAdapter
  },
  {
    name: 'workspace',
    scope: WORKSPACE_SCOPE,
    identifier: undefined,
    storageId: 'ws-1',
    makeDb: file =>
      ({
        project: {
          contentNodes: {
            listWorkspaceContentNodes: vi.fn(async () => [file])
          }
        }
      }) as unknown as DatabaseAdapter
  }
];

describe.each(cases)('downloadContentFile ($name scope)', scopeCase => {
  it('resolves the scope once and reads from its storage namespace', async () => {
    const file = makeFile(scopeCase.name as 'project' | 'entity' | 'workspace');
    const db = scopeCase.makeDb(file);
    const storage = {
      read: vi.fn(async () => Buffer.from('content'))
    } as unknown as StorageAdapter;

    await expect(
      downloadContentFile(
        scopeCase.scope,
        db,
        storage,
        'ws-1',
        scopeCase.identifier,
        file.path,
        event,
        'Failed to download test file'
      )
    ).resolves.toEqual({
      buffer: Buffer.from('content'),
      mimeType: 'text/plain',
      originalFilename: 'readme.txt'
    });

    expect(storage.read).toHaveBeenCalledWith('ws-1', scopeCase.storageId, file.id);
  });
});

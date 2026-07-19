import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { createRoomAuthorizer } from './roomAuthorizer';

const {
  verifyToken,
  fetchWorkspaceAuthorizationContextData,
  buildWorkspaceAuthorizationContext,
  canAccessProject,
  canAccessNonProjectContent
} = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  fetchWorkspaceAuthorizationContextData: vi.fn(),
  buildWorkspaceAuthorizationContext: vi.fn(),
  canAccessProject: vi.fn(),
  canAccessNonProjectContent: vi.fn()
}));

vi.mock('../../utils/jwt', () => ({ verifyToken }));
vi.mock('@arch-register/permissions', () => ({
  fetchWorkspaceAuthorizationContextData,
  buildWorkspaceAuthorizationContext
}));
vi.mock('../auth/authorization', () => ({ canAccessProject, canAccessNonProjectContent }));

const request = (cookie?: string) => ({ headers: { cookie } }) as any;

const makeDb = (node: any = null) =>
  ({
    auth: { getUser: vi.fn(async () => ({ id: 'user-1', is_active: true })) },
    catalog: { resolveWorkspaceSlug: vi.fn(async () => 'workspace-1') },
    project: {
      getAnyContentNodeById: vi.fn(async () => node),
      getProject: vi.fn(async () => ({ owner: 'team-1' }))
    }
  }) as unknown as DatabaseAdapter;

describe('createRoomAuthorizer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    verifyToken.mockReturnValue({ sub: 'user-1', type: 'access', exp: 1234567890 });
    fetchWorkspaceAuthorizationContextData.mockResolvedValue({});
    buildWorkspaceAuthorizationContext.mockReturnValue({});
    canAccessProject.mockReturnValue(true);
    canAccessNonProjectContent.mockReturnValue(true);
  });

  it('returns 401 for a missing or invalid access token', async () => {
    const db = makeDb({ id: 'file-1', project_id: 'project-1', entity_id: null, mount_id: null });
    const authorizer = createRoomAuthorizer(db);

    await expect(authorizer(request(), 'workspace-1/project-1/file-1.json')).resolves.toEqual({
      status: 401
    });

    verifyToken.mockImplementation(() => {
      throw new Error('expired');
    });
    await expect(
      authorizer(request('ar_access_token=bad'), 'workspace-1/project-1/file-1.json')
    ).resolves.toEqual({ status: 401 });
  });

  it('denies unknown nodes and unauthorized project nodes', async () => {
    const unknown = createRoomAuthorizer(makeDb());
    await expect(
      unknown(request('ar_access_token=valid'), 'workspace-1/project-1/missing.json')
    ).resolves.toEqual({ status: 403 });

    canAccessProject.mockReturnValue(false);
    const unauthorized = createRoomAuthorizer(
      makeDb({ id: 'file-1', project_id: 'project-1', entity_id: null, mount_id: null })
    );
    await expect(
      unauthorized(request('ar_access_token=valid'), 'workspace-1/not-the-project/file-1.json')
    ).resolves.toEqual({ status: 403 });
  });

  it('uses the resolved node scope and ignores the legacy project path segment', async () => {
    const db = makeDb({
      id: 'file-1',
      project_id: 'project-1',
      entity_id: null,
      mount_id: null
    });
    const authorizer = createRoomAuthorizer(db);

    await expect(
      authorizer(request('ar_access_token=valid'), 'workspace-1/attacker-project/file-1.json')
    ).resolves.toEqual({
      grant: {
        userId: 'user-1',
        workspace: 'workspace-1',
        storageScope: 'project-1',
        fileId: 'file-1',
        readOnly: false,
        tokenExpiresAt: 1234567890
      }
    });
  });

  it('authorizes non-project content and marks mounted nodes read-only', async () => {
    const db = makeDb({
      id: 'file-1',
      project_id: null,
      entity_id: 'entity-1',
      mount_id: 'mount-1'
    });
    const authorizer = createRoomAuthorizer(db);

    await expect(
      authorizer(request('ar_access_token=valid'), 'workspace-1/workspace-content/file-1.json')
    ).resolves.toMatchObject({
      grant: {
        storageScope: 'entity-1',
        readOnly: true
      }
    });
    expect(canAccessNonProjectContent).toHaveBeenCalledWith({}, 'read');
  });
});

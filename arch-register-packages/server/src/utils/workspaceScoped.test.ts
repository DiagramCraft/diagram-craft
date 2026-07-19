import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveWorkspace: vi.fn(),
  buildApiAuthCtx: vi.fn()
}));

vi.mock('../domain/auth/authorization', () => ({
  buildApiAuthCtx: mocks.buildApiAuthCtx
}));

vi.mock('../domain/workspace/resolveWorkspace', () => ({
  resolveWorkspace: mocks.resolveWorkspace
}));

import { workspaceScoped } from './orpcErrors';

describe('workspaceScoped', () => {
  const db = { catalog: {} } as { catalog: Record<string, never> };
  const event = {} as never;
  const authCtx = { userId: 'user-1' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveWorkspace.mockResolvedValue('workspace-1');
    mocks.buildApiAuthCtx.mockResolvedValue(authCtx);
  });

  it('resolves the workspace and injects the authorization context', async () => {
    const next = vi.fn(async ({ context }: { context: unknown }) => ({
      output: 'result',
      context
    }));

    const result = await workspaceScoped(
      { context: { db, event }, next } as never,
      { params: { workspace: 'workspace-slug' } },
      vi.fn() as never
    );

    expect(mocks.resolveWorkspace).toHaveBeenCalledWith(db.catalog, 'workspace-slug');
    expect(mocks.buildApiAuthCtx).toHaveBeenCalledWith(db, 'workspace-1', event);
    expect(next).toHaveBeenCalledWith({ context: { workspace: 'workspace-1', authCtx } });
    expect(result).toEqual({
      output: 'result',
      context: { workspace: 'workspace-1', authCtx }
    });
  });

  it('does not build authorization context when workspace resolution fails', async () => {
    const error = new Error('workspace not found');
    mocks.resolveWorkspace.mockRejectedValue(error);
    const next = vi.fn();

    await expect(
      workspaceScoped(
        { context: { db, event }, next } as never,
        { params: { workspace: 'missing' } },
        vi.fn() as never
      )
    ).rejects.toBe(error);

    expect(mocks.buildApiAuthCtx).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

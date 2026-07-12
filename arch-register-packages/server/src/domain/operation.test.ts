import { HTTPError } from 'h3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError, type DatabaseAdapter } from '../db/database';
import type { AuthenticatedEvent } from '../middleware/auth';
import type { AuthorizationContext } from '@arch-register/permissions';
import { defineGlobalOperation, defineOperation } from './operation';

const mocks = vi.hoisted(() => ({
  buildApiAuthCtx: vi.fn(),
  resolveWorkspace: vi.fn()
}));

vi.mock('./auth/authorization', () => ({
  GLOBAL_WS: '__global__',
  buildApiAuthCtx: mocks.buildApiAuthCtx
}));

vi.mock('./workspace/resolveWorkspace', () => ({
  resolveWorkspace: mocks.resolveWorkspace
}));

const db = {} as DatabaseAdapter;
const event = {} as AuthenticatedEvent;
const authCtx = { userId: 'user-1' } as AuthorizationContext;

describe('defineOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveWorkspace.mockResolvedValue('ws-1');
    mocks.buildApiAuthCtx.mockResolvedValue(authCtx);
  });

  it('resolves the workspace and provides it with the auth context', async () => {
    const operation = vi.fn(async () => 'result');

    await expect(
      defineOperation(db, 'workspace-slug', event, { fallback: 'Failed' }, operation)
    ).resolves.toBe('result');

    expect(mocks.resolveWorkspace).toHaveBeenCalledWith(undefined, 'workspace-slug');
    expect(mocks.buildApiAuthCtx).toHaveBeenCalledWith(db, 'ws-1', event);
    expect(operation).toHaveBeenCalledWith({ ws: 'ws-1', authCtx });
  });

  it('preserves HTTP errors from the operation', async () => {
    const error = new HTTPError({ status: 404, message: 'Not found' });

    await expect(
      defineOperation(db, 'workspace-slug', event, { fallback: 'Failed' }, async () => {
        throw error;
      })
    ).rejects.toBe(error);
  });

  it('maps unknown and configured database errors through the operation options', async () => {
    await expect(
      defineOperation(db, 'workspace-slug', event, { fallback: 'Failed' }, async () => {
        throw new Error('boom');
      })
    ).rejects.toMatchObject({ statusCode: 500, message: 'Failed' });

    const databaseError = new DatabaseError('unique', 'duplicate');
    await expect(
      defineOperation(
        db,
        'workspace-slug',
        event,
        { fallback: 'Failed', dbErrorMessages: { unique: 'Already exists' } },
        async () => {
          throw databaseError;
        }
      )
    ).rejects.toMatchObject({ statusCode: 409, message: 'Already exists' });
  });
});

describe('defineGlobalOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildApiAuthCtx.mockResolvedValue(authCtx);
  });

  it('builds authorization against the global workspace', async () => {
    const operation = vi.fn(async () => ({ success: true }));

    await expect(
      defineGlobalOperation(db, event, { fallback: 'Failed' }, operation)
    ).resolves.toEqual({ success: true });

    expect(mocks.buildApiAuthCtx).toHaveBeenCalledWith(db, '__global__', event);
    expect(operation).toHaveBeenCalledWith({ authCtx });
    expect(mocks.resolveWorkspace).not.toHaveBeenCalled();
  });
});

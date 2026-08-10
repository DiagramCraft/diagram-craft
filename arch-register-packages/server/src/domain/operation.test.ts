import { HTTPError } from 'h3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError, type DatabaseAdapter } from '../db/database';
import type { AuthenticatedEvent } from '../middleware/auth';
import type { AuthorizationContext } from '@arch-register/permissions';
import { runAuthorizedOperation } from './operation';

const mocks = vi.hoisted(() => ({
  buildApiAuthCtx: vi.fn(),
  buildApiEntityAuthCtx: vi.fn(),
  resolveWorkspace: vi.fn()
}));

vi.mock('./auth/authorization', () => ({
  GLOBAL_WS: '__global__',
  buildApiAuthCtx: mocks.buildApiAuthCtx,
  buildApiEntityAuthCtx: mocks.buildApiEntityAuthCtx
}));

vi.mock('./workspace/resolveWorkspace', () => ({
  resolveWorkspace: mocks.resolveWorkspace
}));

const db = {} as DatabaseAdapter;
const event = {} as AuthenticatedEvent;
const authCtx = { userId: 'user-1' } as AuthorizationContext;

describe('runAuthorizedOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveWorkspace.mockResolvedValue('ws-1');
    mocks.buildApiAuthCtx.mockResolvedValue(authCtx);
    mocks.buildApiEntityAuthCtx.mockResolvedValue(authCtx);
  });

  it('resolves a workspace scope and provides it with the workspace auth context', async () => {
    const operation = vi.fn(async () => 'result');

    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'workspace', workspace: 'workspace-slug' },
        fallback: 'Failed',
        operation
      })
    ).resolves.toBe('result');

    expect(mocks.resolveWorkspace).toHaveBeenCalledWith(undefined, 'workspace-slug');
    expect(mocks.buildApiAuthCtx).toHaveBeenCalledWith(db, 'ws-1', event);
    expect(mocks.buildApiEntityAuthCtx).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledWith({ ws: 'ws-1', authCtx });
  });

  it('resolves an entity scope with the entity auth context', async () => {
    const operation = vi.fn(async () => 'result');

    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'entity', workspace: 'workspace-slug' },
        fallback: 'Failed',
        operation
      })
    ).resolves.toBe('result');

    expect(mocks.resolveWorkspace).toHaveBeenCalledWith(undefined, 'workspace-slug');
    expect(mocks.buildApiEntityAuthCtx).toHaveBeenCalledWith(db, 'ws-1', event);
    expect(mocks.buildApiAuthCtx).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledWith({ ws: 'ws-1', authCtx });
  });

  it('resolves a global scope without resolving a workspace', async () => {
    const operation = vi.fn(async () => ({ success: true }));

    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'global' },
        fallback: 'Failed',
        operation
      })
    ).resolves.toEqual({ success: true });

    expect(mocks.buildApiAuthCtx).toHaveBeenCalledWith(db, '__global__', event);
    expect(mocks.resolveWorkspace).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledWith({ authCtx });
  });

  it('runs before and operation callbacks with the resolved context', async () => {
    const before = vi.fn();
    const operation = vi.fn(async () => 'result');

    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'workspace', workspace: 'workspace-slug' },
        fallback: 'Failed',
        before,
        operation
      })
    ).resolves.toBe('result');

    expect(before).toHaveBeenCalledWith({ ws: 'ws-1', authCtx });
    expect(before.mock.invocationCallOrder[0]).toBeLessThan(operation.mock.invocationCallOrder[0]!);
  });

  it('preserves errors thrown by before callbacks', async () => {
    const error = new Error('forbidden');

    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'workspace', workspace: 'workspace-slug' },
        fallback: 'Failed',
        before: () => {
          throw error;
        },
        operation: async () => 'unreachable'
      })
    ).rejects.toBe(error);
  });

  it('preserves HTTP errors from authorization and operation callbacks', async () => {
    const error = new HTTPError({ status: 404, message: 'Not found' });

    mocks.buildApiAuthCtx.mockRejectedValueOnce(error);
    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'workspace', workspace: 'workspace-slug' },
        fallback: 'Failed',
        operation: async () => 'unreachable'
      })
    ).rejects.toBe(error);

    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'workspace', workspace: 'workspace-slug' },
        fallback: 'Failed',
        operation: async () => {
          throw error;
        }
      })
    ).rejects.toBe(error);
  });

  it('maps unknown and configured database errors through the operation options', async () => {
    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'workspace', workspace: 'workspace-slug' },
        fallback: 'Failed',
        operation: async () => {
          throw new Error('boom');
        }
      })
    ).rejects.toMatchObject({ statusCode: 500, message: 'Failed' });

    const databaseError = new DatabaseError('unique', 'duplicate');
    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'workspace', workspace: 'workspace-slug' },
        fallback: 'Failed',
        dbErrorMessages: { unique: 'Already exists' },
        operation: async () => {
          throw databaseError;
        }
      })
    ).rejects.toMatchObject({ statusCode: 409, message: 'Already exists' });
  });

  it('calls onError before applying the shared error mapping', async () => {
    const error = new Error('boom');
    const onError = vi.fn();

    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'global' },
        fallback: 'Failed',
        onError,
        operation: async () => {
          throw error;
        }
      })
    ).rejects.toMatchObject({ statusCode: 500, message: 'Failed' });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('uses the default internal fallback when none is supplied', async () => {
    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'global' },
        operation: async () => {
          throw new Error('boom');
        }
      })
    ).rejects.toMatchObject({ statusCode: 500, message: 'Internal Server Error' });
  });

  it('maps failures from workspace resolution through the shared error boundary', async () => {
    mocks.resolveWorkspace.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      runAuthorizedOperation({
        db,
        event,
        scope: { kind: 'workspace', workspace: 'workspace-slug' },
        fallback: 'Failed',
        operation: async () => 'unreachable'
      })
    ).rejects.toMatchObject({ statusCode: 500, message: 'Failed' });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { getMarkdownContent, listWorkspaceContentNodes, uploadEntityFile } from './projectOperations';

const { requireWorkspaceCapability } = vi.hoisted(() => ({
  requireWorkspaceCapability: vi.fn()
}));

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
  canAccessProject: vi.fn(),
  requireCanCreateProject: vi.fn(),
  requireProjectAccess: vi.fn(),
  requireProjectAction: vi.fn(),
  requireWorkspaceAdmin: vi.fn(),
  requireWorkspaceCapability
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

describe('entity/workspace content authorization', () => {
  beforeEach(() => {
    requireWorkspaceCapability.mockReset();
  });

  it('requires content.view before listing workspace content', async () => {
    const listNodes = vi.fn(async () => []);
    const db = { project: { listWorkspaceContentNodes: listNodes } } as unknown as DatabaseAdapter;
    requireWorkspaceCapability.mockImplementation(() => {
      throw new Error('forbidden');
    });

    await expect(listWorkspaceContentNodes(db, 'ws-1', event)).rejects.toThrow('forbidden');
    expect(requireWorkspaceCapability).toHaveBeenCalledWith(
      expect.anything(),
      'content.view',
      expect.any(String)
    );
    expect(listNodes).not.toHaveBeenCalled();
  });

  it('requires content.edit before an entity upload mutates data or storage', async () => {
    const getEntity = vi.fn();
    const write = vi.fn();
    const db = { catalog: { getEntity } } as unknown as DatabaseAdapter;
    const storage = { write } as unknown as StorageAdapter;
    requireWorkspaceCapability.mockImplementation(() => {
      throw new Error('forbidden');
    });

    await expect(
      uploadEntityFile(db, storage, 'ws-1', 'entity-1', 'file.txt', Buffer.from('x'), 'text/plain', 'file.txt', event)
    ).rejects.toThrow();
    expect(requireWorkspaceCapability).toHaveBeenCalledWith(
      expect.anything(),
      'content.edit',
      expect.any(String)
    );
    expect(getEntity).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('requires content.view before reading non-project markdown storage', async () => {
    const node = {
      id: 'markdown-1',
      project_id: null,
      entity_id: 'entity-1',
      type: 'markdown'
    };
    const read = vi.fn();
    const db = {
      project: { getAnyContentNodeById: vi.fn(async () => node) }
    } as unknown as DatabaseAdapter;
    const storage = { read } as unknown as StorageAdapter;
    requireWorkspaceCapability.mockImplementation(() => {
      throw new Error('forbidden');
    });

    await expect(getMarkdownContent(db, storage, 'ws-1', node.id, event)).rejects.toThrow();
    expect(requireWorkspaceCapability).toHaveBeenCalledWith(
      expect.anything(),
      'content.view',
      expect.any(String)
    );
    expect(read).not.toHaveBeenCalled();
  });
});

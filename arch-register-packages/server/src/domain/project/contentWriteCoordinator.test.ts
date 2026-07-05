import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { StagedStorageMutation, StorageAdapter } from '../../storage/storage.types';
import { coordinateContentWrite } from './contentWriteCoordinator';

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

const database = (transaction: DatabaseAdapter['core']['transaction']) =>
  ({
    core: { driver: 'sqlite', close: vi.fn(), reset: vi.fn(), transaction }
  }) as unknown as DatabaseAdapter;

const storageWith = (mutation: StagedStorageMutation): StorageAdapter => ({
  read: vi.fn(),
  write: vi.fn(),
  delete: vi.fn(),
  deleteAll: vi.fn(),
  stageWrite: vi.fn().mockResolvedValue(mutation),
  stageDelete: vi.fn().mockResolvedValue(mutation)
});

const mutation = (): StagedStorageMutation => ({
  commit: vi.fn().mockResolvedValue(undefined),
  rollback: vi.fn().mockResolvedValue(undefined),
  finalize: vi.fn().mockResolvedValue(undefined)
});

describe('coordinateContentWrite', () => {
  it('commits storage before the database and finalizes afterward', async () => {
    const calls: string[] = [];
    const staged = mutation();
    vi.mocked(staged.commit).mockImplementation(async () => {
      calls.push('storage');
    });
    vi.mocked(staged.finalize).mockImplementation(async () => {
      calls.push('cleanup');
    });
    const db = database(async callback => {
      calls.push('database');
      return callback(db);
    });

    await coordinateContentWrite({
      db,
      storage: storageWith(staged),
      operation: 'create',
      scope: 'project',
      nodeIds: ['node'],
      storageChanges: [
        {
          type: 'write',
          workspace: 'ws',
          storageId: 'project',
          nodeId: 'node',
          content: Buffer.from('content')
        }
      ],
      writeDatabase: async () => {
        calls.push('write');
      }
    });

    expect(calls).toEqual(['storage', 'database', 'write', 'cleanup']);
    expect(staged.rollback).not.toHaveBeenCalled();
  });

  it('rolls storage back when the database transaction fails', async () => {
    const staged = mutation();
    const failure = new Error('database failed');
    const db = database(async () => {
      throw failure;
    });

    await expect(
      coordinateContentWrite({
        db,
        storage: storageWith(staged),
        operation: 'update',
        scope: 'workspace',
        nodeIds: ['node'],
        storageChanges: [
          {
            type: 'write',
            workspace: 'ws',
            storageId: 'ws',
            nodeId: 'node',
            content: Buffer.from('new')
          }
        ],
        writeDatabase: async () => undefined
      })
    ).rejects.toBe(failure);

    expect(staged.rollback).toHaveBeenCalledOnce();
    expect(staged.finalize).not.toHaveBeenCalled();
  });

  it('does not fail a committed write when a derived stage fails', async () => {
    const db = database(async callback => callback(db));
    const audit = vi.fn().mockRejectedValue(new Error('audit failed'));

    await expect(
      coordinateContentWrite({
        db,
        operation: 'move',
        scope: 'entity',
        nodeIds: ['node'],
        writeDatabase: async () => 'saved',
        afterCommit: [{ name: 'audit', run: audit }]
      })
    ).resolves.toBe('saved');
    expect(audit).toHaveBeenCalledOnce();
  });

  it.each([
    'preview',
    'references',
    'revision',
    'audit'
  ] as const)('continues after a %s failure and runs later stages', async failedStage => {
    const db = database(async callback => callback(db));
    const later = vi.fn().mockResolvedValue(undefined);
    await expect(
      coordinateContentWrite({
        db,
        operation: 'update',
        scope: 'project',
        nodeIds: ['node'],
        writeDatabase: async () => 'saved',
        afterCommit: [
          { name: failedStage, run: vi.fn().mockRejectedValue(new Error(`${failedStage} failed`)) },
          { name: 'audit', run: later }
        ]
      })
    ).resolves.toBe('saved');
    expect(later).toHaveBeenCalledOnce();
  });

  it('rolls back earlier storage mutations when a later commit fails', async () => {
    const first = mutation();
    const second = mutation();
    vi.mocked(second.commit).mockRejectedValue(new Error('second commit failed'));
    const storage = storageWith(first);
    vi.mocked(storage.stageWrite!).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const db = database(async callback => callback(db));

    await expect(
      coordinateContentWrite({
        db,
        storage,
        operation: 'clone',
        scope: 'project',
        nodeIds: ['one', 'two'],
        storageChanges: [
          {
            type: 'write',
            workspace: 'ws',
            storageId: 'p',
            nodeId: 'one',
            content: Buffer.from('1')
          },
          {
            type: 'write',
            workspace: 'ws',
            storageId: 'p',
            nodeId: 'two',
            content: Buffer.from('2')
          }
        ],
        writeDatabase: async () => undefined
      })
    ).rejects.toThrow('second commit failed');
    expect(first.rollback).toHaveBeenCalledOnce();
    expect(second.rollback).toHaveBeenCalledOnce();
  });

  it('reports compensation failure without hiding the primary failure', async () => {
    const primary = new Error('database failed');
    const staged = mutation();
    vi.mocked(staged.rollback).mockRejectedValue(new Error('rollback failed'));
    const db = database(async () => {
      throw primary;
    });

    await expect(
      coordinateContentWrite({
        db,
        storage: storageWith(staged),
        operation: 'delete',
        scope: 'project',
        nodeIds: ['node'],
        storageChanges: [{ type: 'delete', workspace: 'ws', storageId: 'p', nodeId: 'node' }],
        writeDatabase: async () => undefined
      })
    ).rejects.toBe(primary);
  });
});

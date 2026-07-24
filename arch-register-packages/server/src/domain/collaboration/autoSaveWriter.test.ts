import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { createAutoSaveWriter } from './autoSaveWriter';

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

vi.mock('../diagram/commentCounts', () => ({
  getDiagramCommentCounts: () => ({ commentCount: 2, unresolvedCommentCount: 1 })
}));
vi.mock('../diagram/serverDiagramRenderer', () => ({
  generateAccurateSvgPreview: vi.fn(async () => '<svg />')
}));
vi.mock('../diagram/svgPreviewGenerator', () => ({ generateSvgPreview: vi.fn(() => '<svg />') }));

const makeDb = (node: any) =>
  ({
    catalog: { resolveWorkspaceSlug: vi.fn(async () => 'workspace-1') },
    project: {
      getAnyContentNodeById: vi.fn(async () => node),
      updateContentNodeDerivedData: vi.fn(async () => undefined),
      updateWorkspaceContentNodeDerivedData: vi.fn(async () => undefined)
    }
  }) as unknown as DatabaseAdapter;

const makeStorage = () => ({ write: vi.fn(async () => undefined) }) as unknown as StorageAdapter;

describe('createAutoSaveWriter', () => {
  it('writes to the resolved project scope instead of the room path scope', async () => {
    const db = makeDb({
      id: 'file-1',
      project_id: 'true-project',
      entity_id: null,
      mount_id: null
    });
    const storage = makeStorage();
    const writer = createAutoSaveWriter(db, storage);

    await writer('workspace-1/attacker-project/file-1.json', '{"diagrams":[]}');

    expect(storage.write).toHaveBeenCalledWith(
      'workspace-1',
      'true-project',
      'file-1',
      expect.any(Buffer)
    );
    expect(db.project.updateContentNodeDerivedData).toHaveBeenCalledWith(
      'workspace-1',
      'true-project',
      'file-1',
      expect.any(Number),
      2,
      1,
      '<svg />',
      expect.any(Date)
    );
  });

  it('uses entity and workspace derived-data operations for their respective scopes', async () => {
    const entityDb = makeDb({
      id: 'file-1',
      project_id: null,
      entity_id: 'entity-1',
      mount_id: null
    });
    const entityStorage = makeStorage();
    await createAutoSaveWriter(entityDb, entityStorage)(
      'workspace-1/wrong-scope/file-1.json',
      '{"diagrams":[]}'
    );
    expect(entityStorage.write).toHaveBeenCalledWith(
      'workspace-1',
      'entity-1',
      'file-1',
      expect.any(Buffer)
    );
    expect(entityDb.project.updateContentNodeDerivedData).toHaveBeenCalled();

    const workspaceDb = makeDb({ id: 'file-1', project_id: null, entity_id: null, mount_id: null });
    const workspaceStorage = makeStorage();
    await createAutoSaveWriter(workspaceDb, workspaceStorage)(
      'workspace-1/wrong-scope/file-1.json',
      '{"diagrams":[]}'
    );
    expect(workspaceStorage.write).toHaveBeenCalledWith(
      'workspace-1',
      'workspace-1',
      'file-1',
      expect.any(Buffer)
    );
    expect(workspaceDb.project.updateWorkspaceContentNodeDerivedData).toHaveBeenCalled();
  });

  it('does not write unknown or mounted nodes', async () => {
    const unknownDb = makeDb(null);
    const unknownStorage = makeStorage();
    await createAutoSaveWriter(unknownDb, unknownStorage)(
      'workspace-1/project-1/missing.json',
      '{"diagrams":[]}'
    );
    expect(unknownStorage.write).not.toHaveBeenCalled();

    const mountedDb = makeDb({
      id: 'file-1',
      project_id: 'project-1',
      entity_id: null,
      mount_id: 'mount-1'
    });
    const mountedStorage = makeStorage();
    await createAutoSaveWriter(mountedDb, mountedStorage)(
      'workspace-1/project-1/file-1.json',
      '{"diagrams":[]}'
    );
    expect(mountedStorage.write).not.toHaveBeenCalled();
  });
});

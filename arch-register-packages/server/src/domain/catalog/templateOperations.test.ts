import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { createFromTemplate } from './templateOperations';

vi.mock('../diagram/serverDiagramRenderer', () => ({
  generateAccurateSvgPreview: vi.fn(async () => '<svg />')
}));

vi.mock('../diagram/svgPreviewGenerator', () => ({
  generateSvgPreview: vi.fn(() => '<svg-fallback />')
}));

vi.mock('../audit/db/auditLogging', () => ({
  logAudit: vi.fn(async () => {}),
  extractEntityFields: vi.fn((row: unknown) => row)
}));

const now = new Date('2026-06-16T12:00:00.000Z');

const makeAuthContext = (teamIds: string[]) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: teamIds.map(teamId => ({ teamId, role: 'team_admin' as const })),
    schemas: [],
    entities: [],
    grants: []
  });

const makeProject = (id: string, owner: string) => ({
  id,
  workspace: 'ws-1',
  name: id,
  description: '',
  owner,
  status: 'active',
  color: null,
  target_date: null,
  pinned: false,
  owner_name: null,
  created_at: now,
  updated_at: now
});

const makeTemplateFile = (overrides: Record<string, unknown> = {}) => ({
  id: 'file-1',
  workspace: 'ws-1',
  project_id: 'source-project',
  entity_id: null,
  parent_id: null,
  path: 'templates/source.json',
  name: 'Source',
  type: 'diagram',
  size_bytes: 10,
  comment_count: 0,
  unresolved_comment_count: 0,
  is_template: true,
  is_workspace_template: false,
  preview_svg: null,
  created_at: now,
  updated_at: now,
  created_by: null,
  updated_by: null,
  mime_type: null,
  original_filename: null,
  ...overrides
});

const makeValidDocument = () => ({
  diagrams: [
    {
      id: 'diagram-1',
      name: 'Source Diagram',
      layers: [],
      diagrams: [],
      canvas: { x: 0, y: 0, w: 100, h: 100 }
    }
  ],
  customPalette: [],
  styles: {
    edgeStyles: [],
    nodeStyles: [],
    textStyles: []
  },
  schemas: [],
  props: {}
});

const makeDb = () => {
  const getContentNodeByPath = vi.fn(async (_workspace: string, projectId: string, path: string) => {
    if (projectId === 'source-project' && path === 'templates/source.json') {
      return makeTemplateFile();
    }
    return null;
  });

  const upsertContentNode = vi.fn(async (input: { path: string; name: string; size_bytes: number }) => ({
    id: 'new-file',
    workspace: 'ws-1',
    project_id: 'dest-project',
    entity_id: null,
    parent_id: null,
    path: input.path,
    name: input.name,
    type: 'diagram',
    size_bytes: input.size_bytes,
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
    original_filename: null
  }));

  const db = {
    project: {
      getProject: vi.fn(async (_ws: string, id: string) =>
        id === 'dest-project' ? makeProject(id, 'team-dest') : makeProject(id, 'team-source')
      ),
      getContentNodeByPath,
      upsertContentNode,
      updateContentNodeDerivedData: vi.fn(async () => {}),
      deleteContentNodeByPath: vi.fn(async () => null)
    }
  } as unknown as DatabaseAdapter;

  return {
    db,
    getContentNodeByPath,
    upsertContentNode,
    deleteContentNodeByPath: db.project.deleteContentNodeByPath as ReturnType<typeof vi.fn>
  };
};

describe('createFromTemplate', () => {
  it('rejects cloning from a template project the caller cannot access', async () => {
    const getContentNodeByPath = vi.fn();
    const db = {
      project: {
        getProject: vi.fn(async (_ws: string, id: string) =>
          id === 'dest-project' ? makeProject(id, 'team-dest') : makeProject(id, 'team-source')
        ),
        getContentNodeByPath,
        upsertContentNode: vi.fn(),
        updateContentNodeDerivedData: vi.fn(),
        deleteContentNodeByPath: vi.fn()
      }
    } as unknown as DatabaseAdapter;

    await expect(
      createFromTemplate(
        db,
        { read: vi.fn(), write: vi.fn() },
        'ws-1',
        'dest-project',
        'New Diagram',
        'source-project',
        'templates/source.json',
        null,
        makeAuthContext(['team-dest'])
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(getContentNodeByPath).not.toHaveBeenCalled();
  });

  it('rejects cloning from a file that is not marked as a template', async () => {
    const storage = { read: vi.fn(), write: vi.fn() };
    const db = {
      project: {
        getProject: vi.fn(async (_ws: string, id: string) =>
          id === 'dest-project' ? makeProject(id, 'team-dest') : makeProject(id, 'team-source')
        ),
        getContentNodeByPath: vi.fn(async () => makeTemplateFile({ is_template: false })),
        upsertContentNode: vi.fn(),
        updateContentNodeDerivedData: vi.fn(),
        deleteContentNodeByPath: vi.fn()
      }
    } as unknown as DatabaseAdapter;

    await expect(
      createFromTemplate(
        db,
        storage,
        'ws-1',
        'dest-project',
        'New Diagram',
        'source-project',
        'templates/source.json',
        null,
        makeAuthContext(['team-dest', 'team-source'])
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(storage.read).not.toHaveBeenCalled();
  });

  it('rejects using a project-scoped template from another project', async () => {
    const { db } = makeDb();

    await expect(
      createFromTemplate(
        db,
        { read: vi.fn(), write: vi.fn() },
        'ws-1',
        'dest-project',
        'New Diagram',
        'source-project',
        'templates/source.json',
        null,
        makeAuthContext(['team-dest', 'team-source'])
      )
    ).rejects.toMatchObject({
      status: 403,
      message: "Project template 'templates/source.json' can only be used inside its own project"
    });
  });

  it('rejects malformed template documents before creating a file', async () => {
    const { db, upsertContentNode } = makeDb();
    const storage = {
      read: vi.fn(async () => Buffer.from('{"diagrams":"wrong-shape"}', 'utf8')),
      write: vi.fn()
    };

    await expect(
      createFromTemplate(
        db,
        storage,
        'ws-1',
        'source-project',
        'New Diagram',
        'source-project',
        'templates/source.json',
        null,
        makeAuthContext(['team-source'])
      )
    ).rejects.toMatchObject({
      status: 400,
      message: "Template file 'templates/source.json' does not contain a valid diagram document"
    });

    expect(upsertContentNode).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('deletes the inserted node when storage write fails', async () => {
    const { db, deleteContentNodeByPath } = makeDb();
    const storage = {
      read: vi.fn(async () => Buffer.from(JSON.stringify(makeValidDocument()), 'utf8')),
      write: vi.fn(async () => {
        throw new Error('disk full');
      })
    };

    await expect(
      createFromTemplate(
        db,
        storage,
        'ws-1',
        'source-project',
        'New Diagram',
        'source-project',
        'templates/source.json',
        null,
        makeAuthContext(['team-source'])
      )
    ).rejects.toMatchObject({
      status: 500,
      message: 'Failed to create from template'
    });

    expect(deleteContentNodeByPath).toHaveBeenCalledWith(
      'ws-1',
      'source-project',
      'New Diagram.json'
    );
  });

  it('creates a new diagram from a workspace template in another project', async () => {
    const { db, getContentNodeByPath } = makeDb();
    getContentNodeByPath.mockImplementation(async (_workspace: string, projectId: string, path: string) => {
      if (projectId === 'source-project' && path === 'templates/source.json') {
        return makeTemplateFile({ is_workspace_template: true });
      }
      return null;
    });

    const storage = {
      read: vi.fn(async () => Buffer.from(JSON.stringify(makeValidDocument()), 'utf8')),
      write: vi.fn(async () => {})
    };

    const result = await createFromTemplate(
      db,
      storage,
      'ws-1',
      'dest-project',
      'New Diagram',
      'source-project',
      'templates/source.json',
      'folder-a',
      makeAuthContext(['team-dest', 'team-source'])
    );

    expect(storage.write).toHaveBeenCalled();
    expect(result.path).toBe('folder-a/New Diagram.json');
    expect(result.name).toBe('New Diagram');
  });
});

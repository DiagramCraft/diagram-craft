import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext } from '@arch-register/permissions';

const hasWorkspaceCapability = vi.fn();

vi.mock('@arch-register/permissions', () => ({
  PermissionChecker: class {
    hasWorkspaceCapability(...args: Parameters<typeof hasWorkspaceCapability>) {
      return hasWorkspaceCapability(...args);
    }
  }
}));

import { exportWorkspace } from './exportOperations';
import { executeImport, parseImport } from './importOperations';

const makeAuthCtx = (): AuthorizationContext => ({ userId: 'user-1' } as AuthorizationContext);

const makeDb = () =>
  ({
    workspace: {
      getWorkspace: vi.fn(async () => ({
        id: 'workspace-1',
        name: 'Workspace',
        url_slug: 'workspace',
        short_code: 'WS',
        color: '',
        description: '',
        created_at: new Date(),
        updated_at: new Date()
      })),
      listLifecycleStates: vi.fn(async () => []),
      listTeams: vi.fn(async () => []),
      listCustomWorkspaceRoles: vi.fn(async () => []),
      replaceLifecycleStates: vi.fn(async rows => rows),
      replaceTeams: vi.fn(async rows => rows),
      updateCustomWorkspaceRole: vi.fn(async (_ws, _id, input) => ({
        id: _id,
        workspace: _ws,
        ...input
      })),
      createCustomWorkspaceRole: vi.fn(async input => input),
      registerPublicIdPrefix: vi.fn(async () => {}),
      updatePublicIdPrefix: vi.fn(async () => {}),
      deletePublicIdPrefix: vi.fn(async () => {})
    },
    auth: {
      getUser: vi.fn(async () => ({ email: 'user@example.com', display_name: 'User' }))
    },
    catalog: {
      listSchemas: vi.fn(async () => []),
      listEntities: vi.fn(async () => []),
      createSchema: vi.fn(async input => input),
      updateSchema: vi.fn(async (_ws, _id, input) => ({
        id: _id,
        workspace: _ws,
        created_at: new Date(),
        ...input
      })),
      createEntity: vi.fn(async input => input),
      updateEntity: vi.fn(async (_ws, _id, input) => ({
        id: _id,
        workspace: _ws,
        public_id: _id,
        created_at: new Date(),
        ...input
      }))
    },
    project: {
      listProjects: vi.fn(async () => []),
      listAllContentNodes: vi.fn(async () => []),
      createProject: vi.fn(async input => input),
      updateProject: vi.fn(async (_ws, _id, input) => ({
        id: _id,
        workspace: _ws,
        public_id: _id,
        owner_name: null,
        created_at: new Date(),
        updated_at: new Date(),
        ...input
      })),
      upsertContentNode: vi.fn(async input => ({
        id: input.id ?? 'generated-id',
        workspace: input.workspace,
        project_id: input.project_id ?? null,
        entity_id: input.entity_id ?? null,
        parent_id: input.parent_id ?? null,
        path: input.path,
        name: input.name,
        role: input.role ?? null,
        type: input.type ?? 'diagram',
        size_bytes: input.size_bytes,
        comment_count: input.comment_count,
        unresolved_comment_count: input.unresolved_comment_count,
        is_template: false,
        is_workspace_template: false,
        preview_svg: null,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        mime_type: null,
        original_filename: null
      })),
      updateContentNodeDerivedData: vi.fn(async () => {}),
      updateWorkspaceContentNodeDerivedData: vi.fn(async () => {}),
      updateContentNodeTemplateStatus: vi.fn(async () => {})
    }
  }) as any;

describe('workspace export/import guards', () => {
  beforeEach(() => {
    hasWorkspaceCapability.mockReset();
  });

  it('requires ws.settings for workspace export', async () => {
    hasWorkspaceCapability.mockImplementation((_ctx, capability) => capability === 'export');

    await expect(
      exportWorkspace(
        makeDb(),
        undefined,
        makeAuthCtx(),
        'workspace-1',
        { include: ['config'] }
      )
    ).rejects.toMatchObject({ status: 403 });
  });

  it('requires ws.settings for content node import parsing', async () => {
    hasWorkspaceCapability.mockImplementation((_ctx, capability) => capability !== 'ws.settings');

    const result = await parseImport(
      makeDb(),
      makeAuthCtx(),
      'workspace-1',
      {
        version: '1.0',
        format: 'zip-multi-file',
        exported_at: '2026-01-01T00:00:00.000Z',
        exported_by: 'User',
        source_workspace: { id: 'source', name: 'Source', url_slug: 'source' },
        export_options: ['content_nodes'],
        files: {},
        statistics: {
          entity_count: 0,
          project_count: 0,
          schema_count: 0,
          content_node_count: 1,
          total_content_size_bytes: 0
        },
        checksums: {}
      },
      {
        content_nodes: [
          {
            id: 'node-1',
            project_id: null,
            entity_id: null,
            parent_id: null,
            path: 'root',
            name: 'root',
            type: 'folder',
            size_bytes: 0,
            is_template: false,
            is_workspace_template: false
          }
        ]
      }
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('You do not have permission to import content nodes');
  });

  it('persists imported projects and content files during executeImport', async () => {
    const db = makeDb();
    const storage = {
      write: vi.fn(async () => {}),
      read: vi.fn(),
      delete: vi.fn(),
      deleteAll: vi.fn()
    };

    const contentBuffer = Buffer.from('diagram payload', 'utf8');
    const previewBuffer = Buffer.from('<svg />', 'utf8');
    const result = await executeImport(
      db,
      storage as any,
      makeAuthCtx(),
      'workspace-1',
      {
        import_id: 'import-1',
        include: ['projects', 'content_nodes'],
        conflict_resolutions: {},
        preserve_ids: false,
        update_references: true
      },
      {
        projects: [
          {
            id: 'project-old',
            name: 'Imported project',
            description: 'Imported project description',
            owner: null,
            status: 'active',
            color: null
          }
        ],
        content_nodes: [
          {
            id: 'node-old',
            project_id: 'project-old',
            entity_id: null,
            parent_id: null,
            path: 'diagram.json',
            name: 'diagram',
            type: 'diagram',
            size_bytes: 15,
            is_template: true,
            is_workspace_template: false,
            content_file: 'content/diagrams/node-old.json',
            preview_file: 'content/diagrams/node-old.svg'
          }
        ]
      },
      new Map([
        ['content/diagrams/node-old.json', contentBuffer],
        ['content/diagrams/node-old.svg', previewBuffer]
      ])
    );

    expect(result.success).toBe(true);
    expect(result.imported.projects).toEqual({ created: 1, updated: 0 });
    expect(result.imported.content_nodes).toEqual({ created: 1, updated: 0 });
    expect(db.project.createProject).toHaveBeenCalledTimes(1);
    expect(storage.write).toHaveBeenCalledTimes(1);
  });
});

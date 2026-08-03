import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext, type AuthorizationContext } from '@arch-register/permissions';

const hasWorkspaceCapability = vi.fn();

vi.mock('@arch-register/permissions', async importOriginal => {
  const actual = await importOriginal<typeof import('@arch-register/permissions')>();
  return {
    ...actual,
    PermissionChecker: class {
      hasWorkspaceCapability(...args: Parameters<typeof hasWorkspaceCapability>) {
        return hasWorkspaceCapability(...args);
      }
    }
  };
});

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

import { exportWorkspace } from './exportOperations';
import { parseImport } from './importParseOperations';
import { executeImport } from './importExecutionOperations';
import { importEntities, importRelations } from './importAppliers';

const makeAuthCtx = (): AuthorizationContext => ({ userId: 'user-1' }) as AuthorizationContext;

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
      allocatePublicId: vi.fn(async () => 1),
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
      getSchema: vi.fn(async () => null),
      listSharedFieldGroups: vi.fn(async () => []),
      createSharedFieldGroup: vi.fn(async input => input),
      updateSharedFieldGroup: vi.fn(async (_ws, _id, input) => ({
        id: _id,
        workspace: _ws,
        ...input
      })),
      listEntities: vi.fn(async () => []),
      getEntity: vi.fn(async () => null),
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
    document: {
      listDocumentTypes: vi.fn(async () => []),
      listDocumentTemplates: vi.fn(async () => [])
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
    hasWorkspaceCapability.mockImplementation((_ctx, capability) => capability === 'ent.propose');

    await expect(
      exportWorkspace(makeDb(), undefined, makeAuthCtx(), 'workspace-1', { include: ['config'] })
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

  it('diagnoses document templates that reference an unavailable type', async () => {
    hasWorkspaceCapability.mockReturnValue(true);
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
        export_options: ['documents'],
        files: {},
        statistics: {
          entity_count: 0,
          project_count: 0,
          schema_count: 0,
          content_node_count: 0,
          total_content_size_bytes: 0
        },
        checksums: {}
      },
      {
        documents: {
          types: [],
          templates: [
            {
              id: 'template-1',
              workspace: 'source',
              project_id: null,
              name: 'Missing type template',
              body: '# Template',
              document_type_id: 'missing-type',
              metadata_defaults: {},
              archived: false,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z'
            }
          ],
          metadata: [],
          revisions: []
        }
      }
    );

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_reference',
          item_id: 'template-1',
          message: expect.stringContaining("references document type 'missing-type'")
        })
      ])
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("references document type 'missing-type'")])
    );
  });

  it('persists imported projects and content files during executeImport', async () => {
    const db = makeDb();
    const write = vi.fn(
      async (_workspace: string, _storageId: string, _nodeId: string, _content: Buffer) => {}
    );
    const storage = {
      write,
      read: vi.fn(),
      delete: vi.fn(),
      deleteAll: vi.fn(),
      stageWrite: vi.fn(
        async (workspace: string, storageId: string, nodeId: string, content: Buffer) => ({
          commit: () => write(workspace, storageId, nodeId, content),
          rollback: async () => {},
          finalize: async () => {}
        })
      )
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

  it('requires explicit resolutions before mutating conflicting imports', async () => {
    hasWorkspaceCapability.mockReturnValue(true);
    const db = makeDb();
    db.catalog.listSchemas.mockResolvedValueOnce([
      {
        id: 'existing-schema',
        name: 'Service',
        description: '',
        fields: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: 'SVC',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    const result = await executeImport(
      db,
      undefined,
      makeAuthCtx(),
      'workspace-1',
      {
        import_id: 'import-1',
        include: ['schemas'],
        conflict_resolutions: {},
        preserve_ids: false
      },
      {
        schemas: [
          {
            id: 'source-schema',
            name: 'Service',
            fields: [],
            color: null,
            icon: null,
            default_owner: null,
            key_prefix: null
          }
        ]
      }
    );

    expect(result.success).toBe(false);
    expect(result.failure?.stage).toBe('planning');
    expect(db.catalog.createSchema).not.toHaveBeenCalled();
    expect(db.catalog.updateSchema).not.toHaveBeenCalled();
  });

  it('compensates staged storage when the database transaction fails', async () => {
    hasWorkspaceCapability.mockReturnValue(true);
    const db = makeDb();
    const staged = {
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      finalize: vi.fn(async () => {})
    };
    db.core = {
      transaction: vi.fn(async () => {
        throw new Error('database failed');
      })
    };
    const storage = {
      write: vi.fn(),
      read: vi.fn(),
      delete: vi.fn(),
      deleteAll: vi.fn(),
      stageWrite: vi.fn(async () => staged)
    };

    const result = await executeImport(
      db,
      storage as any,
      makeAuthCtx(),
      'workspace-1',
      {
        import_id: 'import-1',
        include: ['projects', 'content_nodes'],
        conflict_resolutions: {},
        preserve_ids: false
      },
      {
        projects: [
          {
            id: 'project-old',
            name: 'Imported project',
            description: '',
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
            size_bytes: 1,
            is_template: false,
            is_workspace_template: false,
            content_file: 'content/diagrams/node-old.json'
          }
        ]
      },
      new Map([['content/diagrams/node-old.json', Buffer.from('x')]])
    );

    expect(result.success).toBe(false);
    expect(result.failure?.compensation).toBe('completed');
    expect(staged.commit).toHaveBeenCalledOnce();
    expect(staged.rollback).toHaveBeenCalledOnce();
    expect(db.project.createProject).not.toHaveBeenCalled();
  });
});

describe('workspace entity import field-group authorization', () => {
  it('rejects restricted values before writing them', async () => {
    const db = makeDb();
    const schema = {
      id: 'schema-1',
      workspace: 'workspace-1',
      name: 'Restricted schema',
      fields: [{ id: 'secret', name: 'Secret', type: 'text', groupId: 'restricted' }],
      groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-1'] } }],
      templates: [],
      color: null,
      icon: null,
      default_owner: null,
      key_prefix: 'RST',
      created_at: new Date(),
      updated_at: new Date()
    } as any;
    db.catalog.getSchema.mockResolvedValue(schema);
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'viewer',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });
    const mapping = {
      schemas: new Map([['source-schema', 'schema-1']]),
      shared_field_groups: new Map(),
      relation_schemas: new Map(),
      entities: new Map(),
      relations: new Map(),
      teams: new Map(),
      lifecycle_states: new Map(),
      projects: new Map(),
      content_nodes: new Map()
    };

    await expect(
      importEntities(
        db,
        authCtx,
        'workspace-1',
        [
          {
            id: 'entity-1',
            public_id: null,
            schema_id: 'source-schema',
            name: 'Restricted entity',
            slug: 'restricted-entity',
            namespace: 'default',
            description: '',
            owner: null,
            lifecycle: null,
            target_lifecycle: null,
            target_lifecycle_date: null,
            tags: [],
            links: [],
            data: { secret: 'must-not-write' },
            project_id: null
          }
        ],
        false,
        {},
        mapping
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(db.catalog.createEntity).not.toHaveBeenCalled();
  });
});

describe('workspace relation import', () => {
  it('remaps both relation endpoints when entity IDs change', async () => {
    const db = makeDb();
    const relationSchema = {
      id: 'target-relation-schema',
      workspace: 'workspace-1',
      name: 'Depends on',
      description: '',
      in_schema_ids: ['target-in-schema'],
      out_schema_ids: ['target-out-schema'],
      fields: [{ id: 'strength', name: 'Strength', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled' as const,
      version: 1,
      created_at: new Date(),
      updated_at: new Date()
    };
    const entities = new Map([
      ['target-in', { id: 'target-in', schema_id: 'target-in-schema' }],
      ['target-out', { id: 'target-out', schema_id: 'target-out-schema' }]
    ]);
    const createRelation = vi.fn(async input => input);
    db.relation = {
      listRelations: vi.fn(async () => ({ items: [], total: 0 })),
      getRelationSchema: vi.fn(async () => relationSchema),
      createRelation,
      updateRelation: vi.fn(),
      deleteRelation: vi.fn()
    };
    db.catalog.getEntity.mockImplementation(
      async (_workspace: string, id: string) => entities.get(id) ?? null
    );

    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'owner',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });
    const result = await importRelations(
      db,
      authCtx,
      'workspace-1',
      [
        {
          id: 'source-relation',
          schema_id: 'source-relation-schema',
          in_entity_id: 'source-in',
          out_entity_id: 'source-out',
          data: { strength: 'strong' },
          version: 2,
          approval_policy_override: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z'
        }
      ],
      false,
      {},
      {
        schemas: new Map(),
        shared_field_groups: new Map(),
        relation_schemas: new Map([['source-relation-schema', 'target-relation-schema']]),
        entities: new Map([
          ['source-in', 'target-in'],
          ['source-out', 'target-out']
        ]),
        relations: new Map(),
        teams: new Map(),
        lifecycle_states: new Map(),
        projects: new Map(),
        content_nodes: new Map()
      }
    );

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(createRelation).toHaveBeenCalledWith(
      expect.objectContaining({
        schema_id: 'target-relation-schema',
        in_entity_id: 'target-in',
        out_entity_id: 'target-out',
        data: { strength: 'strong' }
      })
    );
  });
});

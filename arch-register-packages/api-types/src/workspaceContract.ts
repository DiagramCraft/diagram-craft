import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url_slug: z.string(),
  short_code: z.string(),
  color: z.string(),
  description: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

// ── Request schemas ───────────────────────────────────────────

const deleteWorkspaceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

const workspaceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string()
});

// ── Export/Import schemas ─────────────────────────────────────

const exportDataTypeSchema = z.enum(['config', 'schemas', 'entities', 'projects', 'content_nodes']);

const exportRequestSchema = z.object({
  include: z.array(exportDataTypeSchema),
  options: z.object({
    entity_filters: z.object({
      schema_ids: z.array(z.string()).optional(),
      owner_ids: z.array(z.string()).optional(),
      lifecycle_ids: z.array(z.string()).optional(),
      include_subtrees: z.boolean().optional()
    }).optional(),
    project_ids: z.array(z.string()).optional(),
    include_grants: z.boolean().optional(),
    include_content: z.boolean().optional()
  }).optional()
});

const importParseResponseSchema = z.object({
  valid: z.boolean(),
  version: z.string(),
  import_id: z.string(),
  source_workspace: z.object({
    id: z.string(),
    name: z.string(),
    url_slug: z.string()
  }),
  available_data_types: z.array(exportDataTypeSchema),
  summary: z.object({
    config: z.object({
      lifecycle_states: z.number().int(),
      teams: z.number().int(),
      roles: z.number().int()
    }).optional(),
    schemas: z.object({
      count: z.number().int(),
      conflicts: z.number().int()
    }).optional(),
    entities: z.object({
      count: z.number().int(),
      conflicts: z.number().int()
    }).optional(),
    projects: z.object({
      count: z.number().int(),
      conflicts: z.number().int()
    }).optional(),
    content_nodes: z.object({
      count: z.number().int(),
      conflicts: z.number().int()
    }).optional()
  }),
  conflicts: z.array(z.object({
    type: exportDataTypeSchema,
    item_id: z.string(),
    item_name: z.string(),
    conflict_reason: z.enum(['duplicate_name', 'duplicate_slug', 'missing_dependency', 'schema_mismatch']),
    existing_item: z.record(z.string(), z.unknown()).optional(),
    import_item: z.record(z.string(), z.unknown()),
    suggested_resolution: z.enum(['skip', 'merge', 'overwrite', 'rename'])
  })),
  errors: z.array(z.string()),
  warnings: z.array(z.string())
});

const importExecuteRequestSchema = z.object({
  import_id: z.string(),
  include: z.array(exportDataTypeSchema),
  conflict_resolutions: z.record(z.string(), z.object({
    action: z.enum(['skip', 'merge', 'overwrite', 'rename']),
    new_name: z.string().optional()
  })),
  options: z.object({
    preserve_ids: z.boolean().optional(),
    update_references: z.boolean().optional()
  }).optional()
});

const importExecuteResponseSchema = z.object({
  success: z.boolean(),
  imported: z.object({
    config: z.object({
      lifecycle_states: z.number().int(),
      teams: z.number().int(),
      roles: z.number().int()
    }).optional(),
    schemas: z.object({
      created: z.number().int(),
      updated: z.number().int()
    }).optional(),
    entities: z.object({
      created: z.number().int(),
      updated: z.number().int(),
      skipped: z.number().int()
    }).optional(),
    projects: z.object({
      created: z.number().int(),
      updated: z.number().int()
    }).optional(),
    content_nodes: z.object({
      created: z.number().int(),
      updated: z.number().int()
    }).optional()
  }),
  errors: z.array(z.string()),
  warnings: z.array(z.string())
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceManagementContract = {
  workspaces: {
    list: oc
      .route({ method: 'GET', path: '/workspaces', inputStructure: 'detailed' })
      .output(z.array(workspaceSchema)),
    create: oc
      .route({ method: 'POST', path: '/workspaces', inputStructure: 'detailed' })
      .input(
        z.object({
          body: z.object({
            name: z.string(),
            description: z.string().optional(),
            color: z.string().optional(),
            slug: z.string().optional(),
            badge: z.string().optional(),
            template: z.string().optional(),
            replicate_from: z.string().optional(),
            include: z.array(z.string()).optional()
          })
        })
      )
      .output(workspaceSchema),
    update: oc
      .route({ method: 'PUT', path: '/workspaces/{workspace}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({
            name: z.string(),
            description: z.string().optional(),
            url_slug: z.string().optional(),
            short_code: z.string().optional(),
            color: z.string().optional()
          })
        })
      )
      .output(workspaceSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/workspaces/{workspace}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws
        })
      )
      .output(deleteWorkspaceResponseSchema),
    templates: oc
      .route({ method: 'GET', path: '/workspaces/templates', inputStructure: 'detailed' })
      .output(z.array(workspaceTemplateSchema)),
    export: oc
      .route({ method: 'POST', path: '/{workspace}/export', inputStructure: 'detailed', outputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: exportRequestSchema
        })
      )
      .output(
        z.object({
          headers: z.record(z.string(), z.string()),
          body: z.instanceof(Blob)
        })
      ),
    importParse: oc
      .route({ method: 'POST', path: '/{workspace}/import/parse', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({
            file: z.union([z.instanceof(File), z.instanceof(Blob)])
          })
        })
      )
      .output(importParseResponseSchema),
    importExecute: oc
      .route({ method: 'POST', path: '/{workspace}/import/execute', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: importExecuteRequestSchema
        })
      )
      .output(importExecuteResponseSchema)
  }
};

// ── Workspace Types ───────────────────────────────────────────

export type Workspace = z.infer<typeof workspaceSchema>;

// ── Request Types ─────────────────────────────────────────────

// ── Workspace Configuration ───────────────────────────────────

export type WorkspaceLifecycleState = {
  id: string;
  label: string;
  color: string;
  sort_order: number;
};

export type WorkspaceOwnerOption = {
  id: string;
  name: string;
  sort_order: number;
  color?: string | null;
  description?: string;
};

export type WorkspaceRoleCapability =
  | 'ws.view'
  | 'ws.settings'
  | 'ws.delete'
  | 'ws.audit'
  | 'ws.manage_views'
  | 'people.invite'
  | 'people.role'
  | 'people.remove'
  | 'people.teams'
  | 'proj.create'
  | 'proj.edit'
  | 'ent.edit'
  | 'ent.propose'
  | 'comments'
  | 'export'
  | 'schema.edit'
  | 'schema.publish';

export type WorkspaceRoleDefinition = {
  id: string;
  name: string;
  description: string;
  tone: string;
  builtin: boolean;
  capabilities: WorkspaceRoleCapability[];
  created_at?: string;
  updated_at?: string;
};

export type CreateWorkspaceRoleRequest = {
  name: string;
  description: string;
  tone?: string;
  capabilities: WorkspaceRoleCapability[];
};

export type UpdateWorkspaceRoleRequest = CreateWorkspaceRoleRequest;

// ── Workspace Members ─────────────────────────────────────────

export type WorkspaceUserInfo = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  is_active: boolean;
  color?: string | null;
};

// ── Export/Import Types ───────────────────────────────────────

export type ExportDataType = z.infer<typeof exportDataTypeSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ImportParseResponse = z.infer<typeof importParseResponseSchema>;
export type ImportExecuteRequest = z.infer<typeof importExecuteRequestSchema>;
export type ImportExecuteResponse = z.infer<typeof importExecuteResponseSchema>;

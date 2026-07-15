import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

export const workspaceSchema = z.object({
  id: z.string().describe('Unique workspace identifier'),
  name: z.string().describe('Workspace name'),
  url_slug: z.string().describe('URL-safe workspace identifier'),
  short_code: z.string().describe('Short code for workspace identification'),
  color: z.string().describe('Workspace color (hex format)'),
  description: z.string().describe('Workspace description'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

// ── Request schemas ───────────────────────────────────────────

const deleteWorkspaceResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

const workspaceTemplateSchema = z.object({
  id: z.string().describe('Template identifier'),
  name: z.string().describe('Template name'),
  description: z.string().describe('Template description')
});

// ── Export/Import schemas ─────────────────────────────────────

const exportDataTypeSchema = z
  .enum(['config', 'schemas', 'entities', 'projects', 'content_nodes'])
  .describe('Type of data to export/import');

const exportRequestSchema = z.object({
  include: z.array(exportDataTypeSchema).describe('Data types to include in the export'),
  options: z
    .object({
      entity_filters: z
        .object({
          schema_ids: z.array(z.string()).optional().describe('Filter entities by schema IDs'),
          owner_ids: z.array(z.string()).optional().describe('Filter entities by owner IDs'),
          lifecycle_ids: z
            .array(z.string())
            .optional()
            .describe('Filter entities by lifecycle state IDs'),
          include_subtrees: z.boolean().optional().describe('Include entity relationship subtrees')
        })
        .optional()
        .describe('Entity filtering options'),
      project_ids: z.array(z.string()).optional().describe('Specific project IDs to export'),
      include_grants: z.boolean().optional().describe('Include permission grants in export'),
      include_content: z.boolean().optional().describe('Include file content in export')
    })
    .optional()
    .describe('Export options')
});

const importParseResponseSchema = z.object({
  valid: z.boolean().describe('Whether the import file is valid'),
  version: z.string().describe('Export format version'),
  import_id: z.string().optional().describe('Unique identifier for a valid import session'),
  source_workspace: z
    .object({
      id: z.string().describe('Source workspace identifier'),
      name: z.string().describe('Source workspace name'),
      url_slug: z.string().describe('Source workspace URL slug')
    })
    .describe('Information about the source workspace'),
  available_data_types: z
    .array(exportDataTypeSchema)
    .describe('Data types available in the import file'),
  summary: z
    .object({
      config: z
        .object({
          lifecycle_states: z.number().int().describe('Number of lifecycle states'),
          teams: z.number().int().describe('Number of teams'),
          roles: z.number().int().describe('Number of roles')
        })
        .optional()
        .describe('Configuration summary'),
      schemas: z
        .object({
          count: z.number().int().describe('Total number of schemas'),
          conflicts: z.number().int().describe('Number of conflicting schemas')
        })
        .optional()
        .describe('Schema summary'),
      entities: z
        .object({
          count: z.number().int().describe('Total number of entities'),
          conflicts: z.number().int().describe('Number of conflicting entities')
        })
        .optional()
        .describe('Entity summary'),
      projects: z
        .object({
          count: z.number().int().describe('Total number of projects'),
          conflicts: z.number().int().describe('Number of conflicting projects')
        })
        .optional()
        .describe('Project summary'),
      content_nodes: z
        .object({
          count: z.number().int().describe('Total number of content nodes'),
          conflicts: z.number().int().describe('Number of conflicting content nodes')
        })
        .optional()
        .describe('Content node summary')
    })
    .describe('Summary of import data'),
  conflicts: z
    .array(
      z.object({
        type: exportDataTypeSchema.describe('Type of conflicting item'),
        item_id: z.string().describe('Item identifier'),
        item_name: z.string().describe('Item name'),
        conflict_reason: z
          .enum(['duplicate_name', 'duplicate_slug', 'missing_dependency', 'schema_mismatch'])
          .describe('Reason for conflict'),
        existing_item: z.record(z.string(), z.unknown()).optional().describe('Existing item data'),
        import_item: z.record(z.string(), z.unknown()).describe('Import item data'),
        suggested_resolution: z
          .enum(['skip', 'merge', 'overwrite', 'rename'])
          .describe('Suggested resolution strategy')
      })
    )
    .describe('List of conflicts that need resolution'),
  errors: z.array(z.string()).describe('Import validation errors'),
  warnings: z.array(z.string()).describe('Import validation warnings'),
  diagnostics: z
    .array(
      z.object({
        code: z.enum([
          'invalid_archive',
          'invalid_manifest',
          'checksum_mismatch',
          'duplicate_import_item',
          'missing_reference',
          'missing_content_file',
          'unresolved_conflict'
        ]),
        item_type: exportDataTypeSchema.optional(),
        item_id: z.string().optional(),
        message: z.string()
      })
    )
    .optional()
});

const importExecuteRequestSchema = z.object({
  import_id: z.string().describe('Import session identifier from parse response'),
  include: z.array(exportDataTypeSchema).describe('Data types to import'),
  conflict_resolutions: z
    .record(
      z.string(),
      z.object({
        action: z.enum(['skip', 'merge', 'overwrite', 'rename']).describe('Resolution action'),
        new_name: z.string().optional().describe('New name for rename action')
      })
    )
    .describe('Resolutions for conflicts (keyed by item_id)'),
  options: z
    .object({
      preserve_ids: z.boolean().optional().describe('Preserve original IDs from source workspace'),
      update_references: z.boolean().optional().describe('Update references to match new IDs')
    })
    .optional()
    .describe('Import execution options')
});

const importExecuteResponseSchema = z.object({
  success: z.boolean().describe('Whether the import was successful'),
  imported: z
    .object({
      config: z
        .object({
          lifecycle_states: z.number().int().describe('Number of lifecycle states imported'),
          teams: z.number().int().describe('Number of teams imported'),
          roles: z.number().int().describe('Number of roles imported')
        })
        .optional()
        .describe('Configuration import results'),
      schemas: z
        .object({
          created: z.number().int().describe('Number of schemas created'),
          updated: z.number().int().describe('Number of schemas updated')
        })
        .optional()
        .describe('Schema import results'),
      entities: z
        .object({
          created: z.number().int().describe('Number of entities created'),
          updated: z.number().int().describe('Number of entities updated'),
          skipped: z.number().int().describe('Number of entities skipped')
        })
        .optional()
        .describe('Entity import results'),
      projects: z
        .object({
          created: z.number().int().describe('Number of projects created'),
          updated: z.number().int().describe('Number of projects updated')
        })
        .optional()
        .describe('Project import results'),
      content_nodes: z
        .object({
          created: z.number().int().describe('Number of content nodes created'),
          updated: z.number().int().describe('Number of content nodes updated')
        })
        .optional()
        .describe('Content node import results')
    })
    .describe('Summary of imported items'),
  errors: z.array(z.string()).describe('Import execution errors'),
  warnings: z.array(z.string()).describe('Import execution warnings'),
  failure: z
    .object({
      stage: z.enum(['validation', 'planning', 'storage', 'persistence']),
      message: z.string(),
      affected_items: z.array(z.string()),
      compensation: z.enum(['not_required', 'completed', 'failed']),
      recovery: z.literal('reupload_archive')
    })
    .optional()
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceManagementContract = oc.tag('Workspaces').router({
  workspaces: {
    list: oc
      .route({
        method: 'GET',
        path: '/workspaces',
        inputStructure: 'detailed',
        summary: 'List all workspaces',
        description:
          'Retrieves all workspaces the authenticated user has access to. Results include workspace metadata and configuration.',
        tags: ['Workspaces']
      })
      .output(z.array(workspaceSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/workspaces',
        inputStructure: 'detailed',
        summary: 'Create new workspace',
        description:
          'Creates a new workspace with the specified configuration. Can optionally create from a template or replicate from an existing workspace.',
        tags: ['Workspaces']
      })
      .input(
        z.object({
          body: z.object({
            name: z.string().describe('Workspace name'),
            description: z.string().optional().describe('Workspace description'),
            color: z.string().optional().describe('Workspace color (hex format)'),
            slug: z
              .string()
              .optional()
              .describe('Custom URL slug (auto-generated if not provided)'),
            badge: z.string().optional().describe('Workspace badge/icon'),
            template: z.string().optional().describe('Template ID to create from'),
            replicate_from: z.string().optional().describe('Workspace ID to replicate from'),
            include: z
              .array(z.string())
              .optional()
              .describe('Data types to include when replicating')
          })
        })
      )
      .output(workspaceSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/workspaces/{workspace}',
        inputStructure: 'detailed',
        summary: 'Update workspace',
        description:
          'Updates workspace metadata and configuration. Requires workspace admin permissions.',
        tags: ['Workspaces']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            name: z.string().describe('Workspace name'),
            description: z.string().optional().describe('Workspace description'),
            url_slug: z.string().optional().describe('URL slug'),
            short_code: z.string().optional().describe('Short code'),
            color: z.string().optional().describe('Workspace color (hex format)')
          })
        })
      )
      .output(workspaceSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/workspaces/{workspace}',
        inputStructure: 'detailed',
        summary: 'Delete workspace',
        description:
          'Permanently deletes a workspace and all its data. This operation cannot be undone. Requires workspace admin permissions.',
        tags: ['Workspaces']
      })
      .input(
        z.object({
          params: ws
        })
      )
      .output(deleteWorkspaceResponseSchema),
    templates: oc
      .route({
        method: 'GET',
        path: '/workspaces/templates',
        inputStructure: 'detailed',
        summary: 'List workspace templates',
        description:
          'Retrieves available workspace templates that can be used to create new workspaces with pre-configured schemas and settings.',
        tags: ['Workspaces']
      })
      .output(z.array(workspaceTemplateSchema)),
    export: oc
      .route({
        method: 'POST',
        path: '/{workspace}/export',
        inputStructure: 'detailed',
        outputStructure: 'detailed',
        summary: 'Export workspace data',
        description:
          'Exports workspace data including configuration, schemas, entities, projects, and content. Returns a downloadable file with the exported data.',
        tags: ['Workspaces']
      })
      .input(
        z.object({
          params: ws,
          body: exportRequestSchema
        })
      )
      .output(
        z.object({
          headers: z
            .record(z.string(), z.string())
            .describe('Response headers including Content-Disposition'),
          body: z.instanceof(Blob).describe('Export file as binary blob')
        })
      ),
    importParse: oc
      .route({
        method: 'POST',
        path: '/{workspace}/import/parse',
        inputStructure: 'detailed',
        summary: 'Parse import file',
        description:
          'Validates and analyzes an import file, identifying conflicts and providing a summary. This is the first step in the import process.',
        tags: ['Workspaces']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            file: z.union([z.instanceof(File), z.instanceof(Blob)]).describe('Import file to parse')
          })
        })
      )
      .output(importParseResponseSchema),
    importExecute: oc
      .route({
        method: 'POST',
        path: '/{workspace}/import/execute',
        inputStructure: 'detailed',
        summary: 'Execute import',
        description:
          'Executes the import with the specified conflict resolutions. This is the second step after parsing the import file.',
        tags: ['Workspaces']
      })
      .input(
        z.object({
          params: ws,
          body: importExecuteRequestSchema
        })
      )
      .output(importExecuteResponseSchema)
  }
});

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
  | 'proj.delete'
  | 'content.view'
  | 'content.edit'
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

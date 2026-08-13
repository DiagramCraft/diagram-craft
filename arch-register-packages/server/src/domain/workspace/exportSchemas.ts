import { z } from 'zod';
import type {
  ExportConfig,
  ExportContentNode,
  ExportDocumentData,
  ExportEntity,
  ExportManifest,
  ExportProject,
  ExportRelation,
  ExportRelationSchema,
  ExportSchema
} from './exportTypes';
import { workspaceCapabilityBindingsSchema } from '@arch-register/api-types/workspaceCapabilityContract';

const exportDataTypeSchema = z.enum([
  'config',
  'schemas',
  'relation_schemas',
  'entities',
  'relations',
  'projects',
  'content_nodes',
  'documents'
]);

const exportDiagnosticSchema = z
  .object({
    code: z.enum(['missing_reference', 'filtered_reference', 'unsupported_data']),
    item_type: exportDataTypeSchema.optional(),
    item_id: z.string().optional(),
    message: z.string()
  })
  .passthrough();

export const exportManifestSchema = z
  .object({
    version: z.string(),
    format: z.literal('zip-multi-file'),
    exported_at: z.string(),
    exported_by: z.string(),
    source_workspace: z.object({
      id: z.string(),
      name: z.string(),
      url_slug: z.string()
    }),
    export_options: z.array(exportDataTypeSchema),
    files: z
      .object({
        config: z.string().optional(),
        schemas: z.string().optional(),
        relation_schemas: z.string().optional(),
        entities: z.string().optional(),
        relations: z.string().optional(),
        projects: z.string().optional(),
        content_nodes: z.string().optional(),
        documents: z.string().optional(),
        content_directory: z.string().optional()
      })
      .passthrough(),
    statistics: z
      .object({
        entity_count: z.number().int().nonnegative(),
        project_count: z.number().int().nonnegative(),
        schema_count: z.number().int().nonnegative(),
        relation_schema_count: z.number().int().nonnegative().optional(),
        relation_count: z.number().int().nonnegative().optional(),
        content_node_count: z.number().int().nonnegative(),
        total_content_size_bytes: z.number().int().nonnegative(),
        document_type_count: z.number().int().nonnegative().optional(),
        document_template_count: z.number().int().nonnegative().optional(),
        document_revision_count: z.number().int().nonnegative().optional()
      })
      .passthrough(),
    checksums: z.record(z.string(), z.string()),
    export_diagnostics: z.array(exportDiagnosticSchema).optional()
  })
  .passthrough();

const exportConfigSchema = z.object({
  lifecycle_states: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      color: z.string(),
      sort_order: z.number().int()
    })
  ),
  teams: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sort_order: z.number().int(),
      color: z.string().nullable(),
      description: z.string()
    })
  ),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      tone: z.string(),
      capabilities: z.array(z.string())
    })
  ),
  project_entity_types: z
    .array(z.object({ id: z.string(), label: z.string(), sort_order: z.number().int() }))
    .optional(),
  capability_configurations: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        bindings: workspaceCapabilityBindingsSchema
      })
    )
    .optional()
});

const sharedFieldGroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    fields: z.array(z.unknown()),
    sort_order: z.number().int()
  })
  .passthrough();

const exportSchemaSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: z.string().nullable().optional(),
    fields: z.array(z.unknown()),
    groups: z.array(z.unknown()).optional(),
    shared_field_group_links: z.array(z.unknown()).optional(),
    shared_field_groups: z.array(sharedFieldGroupSchema).optional(),
    templates: z.array(z.unknown()).optional(),
    color: z.string().nullable(),
    icon: z.string().nullable(),
    default_owner: z.string().nullable(),
    key_prefix: z.string().nullable(),
    entity_approval_policy: z.enum(['required', 'disabled']).optional(),
    deprecation_policy: z.enum(['required', 'disabled']).optional(),
    governance_configs: z
      .array(z.object({ case_kind: z.string(), enabled: z.boolean(), config: z.unknown() }))
      .optional()
  })
  .passthrough();

const exportRelationSchemaSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: z.string().nullable().optional(),
    description: z.string(),
    in_schema_ids: z.union([z.array(z.string()), z.literal('any')]),
    out_schema_ids: z.union([z.array(z.string()), z.literal('any')]),
    fields: z.array(z.unknown()),
    groups: z.array(z.unknown()).optional(),
    shared_field_group_links: z.array(z.unknown()).optional(),
    shared_field_groups: z.array(sharedFieldGroupSchema).optional(),
    color: z.string().nullable(),
    icon: z.string().nullable(),
    relation_approval_policy: z.enum(['required', 'disabled']).optional(),
    version: z.number().int().optional()
  })
  .passthrough();

const exportEntitySchema = z
  .object({
    id: z.string(),
    public_id: z.string().nullable(),
    schema_id: z.string(),
    name: z.string(),
    slug: z.string(),
    namespace: z.string(),
    description: z.string(),
    owner: z.string().nullable(),
    lifecycle: z.string().nullable(),
    target_lifecycle: z.string().nullable(),
    target_lifecycle_date: z.string().nullable(),
    tags: z.array(z.string()),
    links: z.array(z.unknown()),
    data: z.record(z.string(), z.unknown()),
    project_id: z.string().nullable(),
    grants: z
      .array(
        z.object({
          id: z.string(),
          principal_type: z.enum(['user', 'team']),
          principal_id: z.string(),
          role: z.string(),
          applies_to: z.enum(['self', 'subtree'])
        })
      )
      .optional()
  })
  .passthrough();

const exportRelationSchema = z
  .object({
    id: z.string(),
    schema_id: z.string(),
    in_entity_id: z.string(),
    out_entity_id: z.string(),
    data: z.record(z.string(), z.unknown()),
    version: z.number().int(),
    approval_policy_override: z.enum(['required', 'disabled']).nullable(),
    created_at: z.string(),
    updated_at: z.string()
  })
  .passthrough();

const exportProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    owner: z.string().nullable(),
    status: z.enum(['pinned', 'active', 'archived']),
    color: z.string().nullable()
  })
  .passthrough();

const exportContentNodeSchema = z
  .object({
    id: z.string(),
    project_id: z.string().nullable(),
    entity_id: z.string().nullable(),
    parent_id: z.string().nullable(),
    path: z.string(),
    name: z.string(),
    type: z.enum(['diagram', 'folder', 'markdown', 'file']),
    size_bytes: z.number().int().nonnegative(),
    is_template: z.boolean(),
    is_workspace_template: z.boolean(),
    content_file: z.string().optional(),
    preview_file: z.string().optional()
  })
  .passthrough();

const exportDocumentDataSchema = z
  .object({
    types: z.array(z.record(z.string(), z.unknown())),
    templates: z.array(z.record(z.string(), z.unknown())),
    metadata: z.array(z.record(z.string(), z.unknown())),
    revisions: z.array(z.record(z.string(), z.unknown())),
    workflow_configs: z.array(z.record(z.string(), z.unknown())).optional()
  })
  .passthrough();

export const exportPackageSchema = z
  .object({
    config: exportConfigSchema.optional(),
    schemas: z.array(exportSchemaSchema).optional(),
    relation_schemas: z.array(exportRelationSchemaSchema).optional(),
    entities: z.array(exportEntitySchema).optional(),
    relations: z.array(exportRelationSchema).optional(),
    projects: z.array(exportProjectSchema).optional(),
    content_nodes: z.array(exportContentNodeSchema).optional(),
    documents: exportDocumentDataSchema.optional()
  })
  .passthrough();

export type ParsedExportPackage = {
  config?: ExportConfig;
  schemas?: ExportSchema[];
  relation_schemas?: ExportRelationSchema[];
  entities?: ExportEntity[];
  relations?: ExportRelation[];
  projects?: ExportProject[];
  content_nodes?: ExportContentNode[];
  documents?: ExportDocumentData;
};

export const parseExportManifest = (value: unknown): ExportManifest =>
  exportManifestSchema.parse(value);

export const parseExportPackage = (value: unknown): ParsedExportPackage =>
  // The schema performs the runtime validation; the export types retain richer
  // API-contract types for the import appliers than the structural archive schema.
  exportPackageSchema.parse(value) as ParsedExportPackage;

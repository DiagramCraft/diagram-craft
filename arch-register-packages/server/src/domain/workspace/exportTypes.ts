// Export/Import type definitions for workspace data

import type {
  DocumentAiAction,
  DocumentField,
  DocumentGeneratedMetadata,
  DocumentMetadata
} from '@arch-register/api-types/documentContract';

export type ExportDataType =
  | 'config'
  | 'schemas'
  | 'entities'
  | 'projects'
  | 'content_nodes'
  | 'documents';

export type ExportManifest = {
  version: string;
  format: 'zip-multi-file';
  exported_at: string;
  exported_by: string;
  source_workspace: {
    id: string;
    name: string;
    url_slug: string;
  };
  export_options: ExportDataType[];
  files: {
    config?: string;
    schemas?: string;
    entities?: string;
    projects?: string;
    content_nodes?: string;
    documents?: string;
    content_directory?: string;
  };
  statistics: {
    entity_count: number;
    project_count: number;
    schema_count: number;
    content_node_count: number;
    total_content_size_bytes: number;
    document_type_count?: number;
    document_template_count?: number;
    document_revision_count?: number;
  };
  checksums: Record<string, string>;
};

export type ExportConfig = {
  lifecycle_states: Array<{
    id: string;
    label: string;
    color: string;
    sort_order: number;
  }>;
  teams: Array<{
    id: string;
    name: string;
    sort_order: number;
    color: string | null;
    description: string;
  }>;
  roles: Array<{
    id: string;
    name: string;
    description: string;
    tone: string;
    capabilities: string[];
  }>;
  project_entity_types?: Array<{
    id: string;
    label: string;
    sort_order: number;
  }>;
};

export type ExportSchema = {
  id: string;
  name: string;
  fields: unknown[];
  templates?: import('@arch-register/api-types/schemaContract').EntityTemplate[];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  key_prefix: string | null;
};

export type ExportEntity = {
  id: string;
  public_id: string | null;
  schema_id: string;
  name: string;
  slug: string;
  namespace: string;
  description: string;
  owner: string | null;
  lifecycle: string | null;
  target_lifecycle: string | null;
  target_lifecycle_date: string | null;
  tags: string[];
  links: unknown[];
  data: Record<string, unknown>;
  project_id: string | null;
  grants?: Array<{
    id: string;
    principal_type: 'user' | 'team';
    principal_id: string;
    role: string;
    applies_to: 'self' | 'subtree';
  }>;
};

export type ExportProject = {
  id: string;
  name: string;
  description: string;
  owner: string | null;
  status: 'pinned' | 'active' | 'archived';
  color: string | null;
};

export type ExportContentNode = {
  id: string;
  project_id: string | null;
  entity_id: string | null;
  parent_id: string | null;
  path: string;
  name: string;
  type: 'diagram' | 'folder' | 'markdown' | 'file';
  size_bytes: number;
  is_template: boolean;
  is_workspace_template: boolean;
  content_file?: string;
  preview_file?: string;
};

export type ExportDocumentData = {
  types: Array<{
    id: string;
    workspace: string;
    name: string;
    description: string;
    fields: DocumentField[];
    aiActions?: DocumentAiAction[];
    color: string | null;
    icon: string | null;
    archived: boolean;
    created_at: string;
    updated_at: string;
  }>;
  templates: Array<{
    id: string;
    workspace: string;
    project_id: string | null;
    name: string;
    body: string;
    document_type_id: string;
    metadata_defaults: DocumentMetadata;
    archived: boolean;
    created_at: string;
    updated_at: string;
  }>;
  metadata: Array<{
    node_id: string;
    document_type_id: string | null;
    values: DocumentMetadata;
    generated_metadata?: DocumentGeneratedMetadata;
    links: Array<{
      field_id: string;
      target_type: 'entity' | 'document';
      target_id: string;
      position: number;
    }>;
  }>;
  revisions: Array<{
    id: string;
    node_id: string;
    revision_number: number;
    title: string | null;
    body: string;
    created_at: string;
    created_by: string | null;
    restored_from_revision_id: string | null;
    document_type_id: string | null;
    metadata: DocumentMetadata;
  }>;
};

export type ExportOptions = {
  include: ExportDataType[];
  entity_filters?: {
    schema_ids?: string[];
    owner_ids?: string[];
    lifecycle_ids?: string[];
    include_subtrees?: boolean;
  };
  project_ids?: string[];
  include_grants?: boolean;
  include_content?: boolean;
};

export type ImportConflict = {
  type: ExportDataType;
  item_id: string;
  item_name: string;
  conflict_reason: 'duplicate_name' | 'duplicate_slug' | 'missing_dependency' | 'schema_mismatch';
  existing_item?: Record<string, unknown>;
  import_item: Record<string, unknown>;
  suggested_resolution: 'skip' | 'merge' | 'overwrite' | 'rename';
};

export type ImportDiagnostic = {
  code:
    | 'invalid_archive'
    | 'invalid_manifest'
    | 'checksum_mismatch'
    | 'duplicate_import_item'
    | 'missing_reference'
    | 'missing_content_file'
    | 'unresolved_conflict';
  item_type?: ExportDataType;
  item_id?: string;
  message: string;
};

export type ImportFailureReport = {
  stage: 'validation' | 'planning' | 'storage' | 'persistence';
  message: string;
  affected_items: string[];
  compensation: 'not_required' | 'completed' | 'failed';
  recovery: 'reupload_archive';
};

export type ImportParseResult = {
  valid: boolean;
  version: string;
  source_workspace: {
    id: string;
    name: string;
    url_slug: string;
  };
  available_data_types: ExportDataType[];
  summary: {
    config?: {
      lifecycle_states: number;
      teams: number;
      roles: number;
    };
    schemas?: {
      count: number;
      conflicts: number;
    };
    entities?: {
      count: number;
      conflicts: number;
    };
    projects?: {
      count: number;
      conflicts: number;
    };
    content_nodes?: {
      count: number;
      conflicts: number;
    };
    documents?: {
      count: number;
      templates: number;
      revisions: number;
      conflicts: number;
    };
  };
  conflicts: ImportConflict[];
  errors: string[];
  warnings: string[];
  diagnostics?: ImportDiagnostic[];
};

export type ConflictResolution = {
  action: 'skip' | 'merge' | 'overwrite' | 'rename';
  new_name?: string;
};

export type ImportExecuteOptions = {
  import_id: string;
  include: ExportDataType[];
  conflict_resolutions: Record<string, ConflictResolution>;
  preserve_ids?: boolean;
  update_references?: boolean;
};

export type ImportExecuteResult = {
  success: boolean;
  imported: {
    config?: {
      lifecycle_states: number;
      teams: number;
      roles: number;
    };
    schemas?: {
      created: number;
      updated: number;
    };
    entities?: {
      created: number;
      updated: number;
      skipped: number;
    };
    projects?: {
      created: number;
      updated: number;
    };
    content_nodes?: {
      created: number;
      updated: number;
    };
    documents?: {
      created: number;
      templates: number;
      metadata: number;
      revisions: number;
    };
  };
  errors: string[];
  warnings: string[];
  failure?: ImportFailureReport;
};

export type IdMapping = {
  schemas: Map<string, string>;
  entities: Map<string, string>;
  teams: Map<string, string>;
  lifecycle_states: Map<string, string>;
  projects: Map<string, string>;
  content_nodes: Map<string, string>;
};

export type WorkspaceImportPlan = {
  include: ExportDataType[];
  id_mapping: Record<keyof IdMapping, Record<string, string>>;
  storage_writes: Array<{
    workspace: string;
    storage_id: string;
    node_id: string;
    source_path: string;
  }>;
  conflicts: ImportConflict[];
  diagnostics: ImportDiagnostic[];
};

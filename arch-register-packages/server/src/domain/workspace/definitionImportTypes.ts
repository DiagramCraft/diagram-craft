import type {
  DefinitionImportDependencyMapping,
  DefinitionImportRename,
  DefinitionImportSelection,
  DefinitionImportSource
} from '@arch-register/api-types/workspaceContract';
import type {
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import type { DocumentAiAction, DocumentField } from '@arch-register/api-types/documentContract';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { WorkspaceCapabilityBindings } from '@arch-register/api-types/workspaceCapabilityContract';
import type { TemplateDependencyDescriptor } from '@arch-register/api-types/workspaceContract';
import type {
  SchemaDbResult,
  SharedFieldGroupDbResult,
  WorkspaceEnumDbResult
} from '../catalog/db/catalogDatabase';
import type {
  RelationSchemaDbResult,
  RelationSchemaGroupDbShape
} from '../catalog/db/relationDatabase';
import type { DocumentTypeDbResult } from '../document/db/documentDatabase';

export type ImportableSchema = {
  id: string;
  name: string;
  category: string | null;
  description: string;
  key_prefix: string;
  fields: SchemaField[];
  groups: SchemaGroup[];
  shared_field_group_links: SharedFieldGroupLink[];
  shared_field_groups: Array<{
    id: string;
    name: string;
    description: string | null;
    fields: SchemaField[];
    sort_order: number;
  }>;
  color: string | null;
  icon: string | null;
  default_owner_name: string | null;
  entity_approval_policy: 'required' | 'disabled';
  deprecation_policy: 'required' | 'disabled';
};

export type ImportableEnum = {
  id: string;
  name: string;
  options: Array<{
    value: string;
    label: string;
    description?: string | null;
    retired?: boolean;
    restricted?: boolean;
  }>;
  sort_order: number;
};

export type ImportableDocumentType = {
  id: string;
  name: string;
  description: string;
  fields: DocumentField[];
  aiActions: DocumentAiAction[];
  color: string | null;
  icon: string | null;
};

export type ImportableRelationSchema = {
  id: string;
  name: string;
  category: string | null;
  description: string;
  in_schema_ids: string[] | 'any';
  out_schema_ids: string[] | 'any';
  in_label?: string | null;
  out_label?: string | null;
  fields: RelationField[];
  groups: RelationSchemaGroupDbShape[];
  shared_field_group_links: SharedFieldGroupLink[];
  shared_field_groups: Array<{
    id: string;
    name: string;
    description: string | null;
    fields: SchemaField[];
    sort_order: number;
  }>;
  color: string | null;
  icon: string | null;
  relation_approval_policy: 'required' | 'disabled';
  unique_endpoint_pair?: boolean;
};

export type ImportableFieldGroup = {
  id: string;
  name: string;
  description: string | null;
  fields: SchemaField[];
  sort_order: number;
};

export type ImportableCapabilityConfiguration = {
  id: string;
  type: string;
  bindings: WorkspaceCapabilityBindings;
  view_config?: unknown | null;
};

export type ImportableSchemaPatch = {
  ownerId: string;
  target: string;
  fields: SchemaField[];
};

export type PlannedSchemaPatch = {
  targetSchemaId: string;
  targetSchemaName: string;
  fields: SchemaField[];
};

export type DefinitionSource = {
  kind: DefinitionImportSource['kind'];
  id: string;
  name: string;
  description: string;
  category: 'full' | 'cross-cutting' | null;
  schemas: ImportableSchema[];
  enums: ImportableEnum[];
  documentTypes: ImportableDocumentType[];
  relationSchemas: ImportableRelationSchema[];
  fieldGroups: ImportableFieldGroup[];
  capabilityConfigurations: ImportableCapabilityConfiguration[];
  dashboardWidgets: DashboardWidget[];
  dependencies: TemplateDependencyDescriptor[];
  schemaPatches: ImportableSchemaPatch[];
  teamNames: Record<string, string>;
};

export type DefinitionImportTargetState = {
  schemas: SchemaDbResult[];
  enums: WorkspaceEnumDbResult[];
  documentTypes: DocumentTypeDbResult[];
  relationSchemas: RelationSchemaDbResult[];
  fieldGroups: SharedFieldGroupDbResult[];
  isSchemaKeyPrefixUsed: (prefix: string) => Promise<boolean>;
};

export type DefinitionImportPlan = {
  source: DefinitionImportSource;
  selection: DefinitionImportSelection;
  renames: DefinitionImportRename[];
  schemas: ImportableSchema[];
  enums: ImportableEnum[];
  documentTypes: ImportableDocumentType[];
  relationSchemas: ImportableRelationSchema[];
  fieldGroups: ImportableFieldGroup[];
  capabilityConfigurations: ImportableCapabilityConfiguration[];
  dashboardWidgets: DashboardWidget[];
  dependencyMappings: DefinitionImportDependencyMapping[];
  schemaPatches: PlannedSchemaPatch[];
  conflicts: Array<{
    kind: 'schema' | 'enum' | 'documentType' | 'relationSchema' | 'fieldGroup';
    id: string;
    name: string;
    existingName: string;
  }>;
  keyPrefixRemaps: Array<{ sourceId: string; name: string; from: string; to: string }>;
  errors: string[];
  fingerprint: string;
  sourceTeamNames: Record<string, string>;
};

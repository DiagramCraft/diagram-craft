// ── Schema Field Types ────────────────────────────────────────

export type TextField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
  requirementLevel?: 'required' | 'expected' | 'optional';
};

export type BooleanField = {
  id: string;
  name: string;
  type: 'boolean';
  requirementLevel?: 'required' | 'expected' | 'optional';
};

export type DateField = {
  id: string;
  name: string;
  type: 'date';
  requirementLevel?: 'required' | 'expected' | 'optional';
};

export type SelectField = {
  id: string;
  name: string;
  type: 'select';
  options: Array<{ value: string; label: string }>;
  enumId?: string;
  requirementLevel?: 'required' | 'expected' | 'optional';
};

export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
  requirementLevel?: 'required' | 'expected' | 'optional';
};

export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
  requirementLevel?: 'required' | 'expected' | 'optional';
};

export type SchemaField =
  | TextField
  | BooleanField
  | DateField
  | SelectField
  | ReferenceField
  | ContainmentField;

export type FieldType = SchemaField['type'];

// ── Entity Schema ─────────────────────────────────────────────

export type EntitySchema = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  fields: SchemaField[];
  color: string | null;
  icon: string | null;
  entity_count: number;
  created_at: string;
  updated_at: string;
};

// ── Request Types ─────────────────────────────────────────────

export type CreateSchemaRequest = {
  name: string;
  description?: string;
  fields?: SchemaField[];
  color?: string | null;
  icon?: string | null;
};

export type UpdateSchemaRequest = CreateSchemaRequest;

// ── Search Result ─────────────────────────────────────────────

export type SchemaSearchResult = {
  schemaId: string;
  name: string;
  fieldMatches: Array<{ fieldId: string; fieldName: string }>;
};

// ── Workspace Enum ────────────────────────────────────────────

export type WorkspaceEnum = {
  id: string;
  workspace: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CreateEnumRequest = {
  name: string;
  options?: Array<{ value: string; label: string }>;
  sort_order?: number;
};

export type UpdateEnumRequest = CreateEnumRequest;

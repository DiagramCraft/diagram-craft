import type { z } from 'zod';
import type {
  createEnumBodySchema,
  updateEnumBodySchema,
  workspaceEnumSchema
} from './enumContract.js';

// ── Schema Field Types ────────────────────────────────────────

export type RequirementLevel = 'required' | 'expected' | 'optional';

export type FieldOption = {
  value: string;
  label: string;
};

export type TextField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
  requirementLevel?: RequirementLevel;
};

export type BooleanField = {
  id: string;
  name: string;
  type: 'boolean';
  requirementLevel?: RequirementLevel;
};

export type DateField = {
  id: string;
  name: string;
  type: 'date';
  requirementLevel?: RequirementLevel;
};

export type SelectField = {
  id: string;
  name: string;
  type: 'select';
  enumId: string;
  requirementLevel?: RequirementLevel;
};

export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
  requirementLevel?: RequirementLevel;
};

export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
  requirementLevel?: RequirementLevel;
};

export type SchemaField =
  | TextField
  | BooleanField
  | DateField
  | SelectField
  | ReferenceField
  | ContainmentField;

export type ApiSelectField = SelectField & {
  options: FieldOption[];
};

export type ApiSchemaField =
  | TextField
  | BooleanField
  | DateField
  | ApiSelectField
  | ReferenceField
  | ContainmentField;

export type FieldType = SchemaField['type'];

// ── Entity Schema ─────────────────────────────────────────────

export type EntitySchema = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  fields: ApiSchemaField[];
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

export type WorkspaceEnum = z.infer<typeof workspaceEnumSchema>;

export type CreateEnumRequest = z.infer<typeof createEnumBodySchema>;

export type UpdateEnumRequest = z.infer<typeof updateEnumBodySchema>;

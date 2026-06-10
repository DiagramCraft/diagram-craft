import type { z } from 'zod';
import type {
  createEnumBodySchema,
  updateEnumBodySchema,
  workspaceEnumSchema
} from './enumContract.js';
import type {
  entitySchemaSchema,
  fieldOptionSchema,
  schemaFieldResponseSchema,
  selectFieldResponseSchema
} from './schemaContract.js';
import type { schemaSearchResultSchema } from './searchContract.js';

// ── Schema Field Types ────────────────────────────────────────

export type RequirementLevel = 'required' | 'expected' | 'optional';

export type FieldOption = z.infer<typeof fieldOptionSchema>;

export type TextField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
  requirementLevel?: RequirementLevel | null;
};

export type BooleanField = {
  id: string;
  name: string;
  type: 'boolean';
  requirementLevel?: RequirementLevel | null;
};

export type DateField = {
  id: string;
  name: string;
  type: 'date';
  requirementLevel?: RequirementLevel | null;
};

export type SelectField = {
  id: string;
  name: string;
  type: 'select';
  enumId: string;
  requirementLevel?: RequirementLevel | null;
};

export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
  requirementLevel?: RequirementLevel | null;
};

export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
  requirementLevel?: RequirementLevel | null;
};

export type SchemaField =
  | TextField
  | BooleanField
  | DateField
  | SelectField
  | ReferenceField
  | ContainmentField;

export type ApiSelectField = z.infer<typeof selectFieldResponseSchema>;

export type ApiSchemaField = z.infer<typeof schemaFieldResponseSchema>;

export type FieldType = SchemaField['type'];

// ── Entity Schema ─────────────────────────────────────────────

export type EntitySchema = z.infer<typeof entitySchemaSchema>;

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

export type SchemaSearchResult = z.infer<typeof schemaSearchResultSchema>;

// ── Workspace Enum ────────────────────────────────────────────

export type WorkspaceEnum = z.infer<typeof workspaceEnumSchema>;

export type CreateEnumRequest = z.infer<typeof createEnumBodySchema>;

export type UpdateEnumRequest = z.infer<typeof updateEnumBodySchema>;

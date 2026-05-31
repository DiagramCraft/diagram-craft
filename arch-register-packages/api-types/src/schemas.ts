// ── Schema Field Types ────────────────────────────────────────

export type TextField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

export type BooleanField = {
  id: string;
  name: string;
  type: 'boolean';
};

export type SelectField = {
  id: string;
  name: string;
  type: 'select';
  options: Array<{ value: string; label: string }>;
};

export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type SchemaField = TextField | BooleanField | SelectField | ReferenceField | ContainmentField;

export type FieldType = SchemaField['type'];

// ── Entity Schema ─────────────────────────────────────────────

export type EntitySchema = {
  id: string;
  workspace: string;
  name: string;
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
  fields?: SchemaField[];
  color?: string | null;
  icon?: string | null;
};

export type UpdateSchemaRequest = Partial<CreateSchemaRequest>;

// ── Search Result ─────────────────────────────────────────────

export type SchemaSearchResult = {
  schemaId: string;
  name: string;
  fieldMatches: Array<{ fieldId: string; fieldName: string }>;
};

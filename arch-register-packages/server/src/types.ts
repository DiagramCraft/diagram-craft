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

// Points to another entity of a given schema type; multiple values stored as comma-separated UUIDs.
// maxCount: -1 means unbounded.
export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

// Like ReferenceField but expresses a parent/child containment relationship.
// The child entity stores the parent's UUID in its data.
export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type SchemaField = TextField | BooleanField | SelectField | ReferenceField | ContainmentField;

export type EntitySchema = {
  id: string;
  name: string;
  fields: SchemaField[];
  created_at: Date;
  updated_at: Date;
};

export type LifecycleStatus = 'experimental' | 'production' | 'deprecated';

export type Entity = {
  id: string;
  slug: string;
  namespace: string;
  name: string;
  owner: string | null;
  lifecycle: LifecycleStatus | null;
  schema_id: string;
  data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

// Wire format returned by the API: first-class metadata prefixed with _ to avoid clashing with data fields.
export type EntityApiResponse = {
  _uid: string;
  _schemaId: string;
  _slug: string;
  _namespace: string;
  _owner: string | null;
  _lifecycle: LifecycleStatus | null;
  [field: string]: unknown;
};

export const encodeRefs = (refs: string[]): string => refs.join(',');
export const decodeRefs = (raw: unknown): string[] => {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

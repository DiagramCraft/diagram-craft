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

export type Workspace = {
  id: string;
  name: string;
  url_slug: string;
  short_code: string;
  description: string;
  created_at: Date;
  updated_at: Date;
};

export type EntitySchema = {
  id: string;
  workspace: string;
  name: string;
  fields: SchemaField[];
  color: string | null;
  icon: string | null;
  created_at: Date;
  updated_at: Date;
};

export type LifecycleStatus = 'proposed' | 'experimental' | 'production' | 'deprecated';

export type EntityLink = {
  url: string;
  title: string;
  type?: string;
};

export type Entity = {
  id: string;
  workspace: string;
  slug: string;
  namespace: string;
  name: string;
  description: string;
  owner: string | null;
  lifecycle: LifecycleStatus | null;
  tags: string[];
  links: EntityLink[];
  schema_id: string;
  data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

// Wire format returned by the API: first-class metadata prefixed with _ to avoid clashing with data fields.
export type EntityApiResponse = {
  _uid: string;
  _workspace: string;
  _schemaId: string;
  _name: string;
  _slug: string;
  _namespace: string;
  _description: string;
  _owner: string | null;
  _lifecycle: LifecycleStatus | null;
  _tags: string[];
  _links: EntityLink[];
  [field: string]: unknown;
};

export type Project = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  status: 'pinned' | 'active' | 'archived';
  created_at: Date;
  updated_at: Date;
};

export type ProjectFile = {
  id: string;
  workspace: string;
  project_id: string;
  path: string;
  name: string;
  size_bytes: number;
  created_at: Date;
  updated_at: Date;
};

export const encodeRefs = (refs: string[]): string => refs.join(',');
export const decodeRefs = (raw: unknown): string[] => {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditEntityType = 'workspace' | 'entity_schema' | 'entity' | 'project' | 'project_file';

export type AuditLogEntry = {
  id: string;
  workspace: string;
  timestamp: Date;
  user_id: string;
  operation: AuditOperation;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string;
  entity_slug: string | null;
  schema_id: string | null;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
};

export type AuditLogApiResponse = {
  id: string;
  workspace: string;
  timestamp: string;
  user_id: string;
  operation: AuditOperation;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string;
  entity_slug: string | null;
  schema_id: string | null;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
};

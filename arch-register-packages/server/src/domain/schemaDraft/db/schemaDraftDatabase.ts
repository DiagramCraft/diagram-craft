import { databaseDate } from '../../../db/rowMappers';

export const SCHEMA_DRAFT_KINDS = [
  'entity_schema',
  'relation_schema',
  'document_type',
  'enum',
  'field_group',
  'category'
] as const;
export type SchemaDraftKind = (typeof SCHEMA_DRAFT_KINDS)[number];

export const SCHEMA_DRAFT_OPS = ['create', 'update', 'delete'] as const;
export type SchemaDraftOp = (typeof SCHEMA_DRAFT_OPS)[number];

export const SCHEMA_CHANGE_MODES = ['direct', 'draft'] as const;
export type SchemaChangeMode = (typeof SCHEMA_CHANGE_MODES)[number];

export type SchemaDraftDbResult = {
  workspace: string;
  revision: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SchemaDraftItemDbResult = {
  id: string;
  workspace: string;
  kind: SchemaDraftKind;
  item_id: string;
  op: SchemaDraftOp;
  payload: unknown | null;
  base_version: string | null;
  updated_by: string | null;
  updated_at: Date;
};

export type SchemaDraftStageInput = {
  workspace: string;
  kind: SchemaDraftKind;
  item_id: string;
  op: SchemaDraftOp;
  payload: unknown | null;
  base_version: string | null;
  updated_by: string | null;
};

export const SNAPSHOT_VERSION_KINDS = ['enum', 'field_group', 'category'] as const;
export type SnapshotVersionKind = (typeof SNAPSHOT_VERSION_KINDS)[number];

export type SchemaPublicationDbResult = {
  id: string;
  workspace: string;
  number: number;
  summary: string;
  author: string | null;
  published_at: Date;
  migration_details: unknown[];
  items: unknown[];
};

export type SchemaPublicationCreateInput = {
  workspace: string;
  summary: string;
  author: string | null;
  migration_details: unknown[];
  items: unknown[];
};

export type SnapshotVersionDbResult = {
  id: string;
  workspace: string;
  item_id: string;
  version: number;
  snapshot: unknown;
  change_summary: string | null;
  publication_id: string | null;
  created_by: string | null;
  created_at: Date;
};

export type SnapshotVersionCreateInput = {
  workspace: string;
  item_id: string;
  snapshot: unknown;
  change_summary: string | null;
  publication_id: string | null;
  created_by: string | null;
};

const nullableString = (value: unknown) => (value == null ? null : String(value));

export const mapSchemaDraftRow = (row: Record<string, unknown>): SchemaDraftDbResult => ({
  workspace: String(row['workspace']),
  revision: Number(row['revision']),
  created_by: nullableString(row['created_by']),
  updated_by: nullableString(row['updated_by']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at'])
});

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value == null) return fallback;
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
};

export const mapSchemaPublicationRow = (
  row: Record<string, unknown>
): SchemaPublicationDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  number: Number(row['number']),
  summary: String(row['summary'] ?? ''),
  author: nullableString(row['author']),
  published_at: databaseDate(row['published_at']),
  migration_details: parseJson<unknown[]>(row['migration_details'], []),
  items: parseJson<unknown[]>(row['items'], [])
});

export const mapSnapshotVersionRow = (row: Record<string, unknown>): SnapshotVersionDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  item_id: String(row['item_id']),
  version: Number(row['version']),
  snapshot: parseJson<unknown>(row['snapshot'], null),
  change_summary: nullableString(row['change_summary']),
  publication_id: nullableString(row['publication_id']),
  created_by: nullableString(row['created_by']),
  created_at: databaseDate(row['created_at'])
});

export const SNAPSHOT_VERSION_TABLES: Record<SnapshotVersionKind, string> = {
  enum: 'workspace_enum_version',
  field_group: 'workspace_field_group_version',
  category: 'workspace_category_version'
};

/** sqlite stores payload as JSON text; postgres.js already parses JSONB. */
export const parseDraftPayload = (value: unknown): unknown | null => {
  if (value == null) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
};

export const mapSchemaDraftItemRow = (row: Record<string, unknown>): SchemaDraftItemDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  kind: String(row['kind']) as SchemaDraftKind,
  item_id: String(row['item_id']),
  op: String(row['op']) as SchemaDraftOp,
  payload: parseDraftPayload(row['payload']),
  base_version: nullableString(row['base_version']),
  updated_by: nullableString(row['updated_by']),
  updated_at: databaseDate(row['updated_at'])
});

/**
 * Revision 0 means "no draft exists". Every mutating operation takes the revision the caller last
 * saw and returns `null` (without writing) when it no longer matches.
 */
export type SchemaDraftDatabase = {
  getDraft(workspace: string): Promise<SchemaDraftDbResult | null>;
  listItems(workspace: string): Promise<SchemaDraftItemDbResult[]>;
  stageItem(
    input: SchemaDraftStageInput,
    expectedRevision: number
  ): Promise<SchemaDraftDbResult | null>;
  unstageItem(
    workspace: string,
    kind: SchemaDraftKind,
    itemId: string,
    expectedRevision: number,
    updatedBy: string | null
  ): Promise<SchemaDraftDbResult | null>;
  /** Deletes the draft and all of its items. Returns false on revision mismatch. */
  discard(workspace: string, expectedRevision: number): Promise<boolean>;
  getSchemaChangeMode(workspace: string): Promise<SchemaChangeMode>;
  setSchemaChangeMode(
    workspace: string,
    mode: SchemaChangeMode,
    updatedBy: string | null
  ): Promise<void>;

  /** Inserts a publication with number = max(number) + 1 for the workspace. */
  createPublication(input: SchemaPublicationCreateInput): Promise<SchemaPublicationDbResult>;
  listPublications(workspace: string): Promise<SchemaPublicationDbResult[]>;
  getPublication(workspace: string, number: number): Promise<SchemaPublicationDbResult | null>;

  /** Appends a version (max + 1) of an enum / field group / category snapshot. */
  createSnapshotVersion(
    kind: SnapshotVersionKind,
    input: SnapshotVersionCreateInput
  ): Promise<SnapshotVersionDbResult>;
  listSnapshotVersions(
    kind: SnapshotVersionKind,
    workspace: string,
    itemId: string
  ): Promise<SnapshotVersionDbResult[]>;
  getSnapshotVersion(
    kind: SnapshotVersionKind,
    workspace: string,
    itemId: string,
    version: number
  ): Promise<SnapshotVersionDbResult | null>;
};

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

const nullableString = (value: unknown) => (value == null ? null : String(value));

export const mapSchemaDraftRow = (row: Record<string, unknown>): SchemaDraftDbResult => ({
  workspace: String(row['workspace']),
  revision: Number(row['revision']),
  created_by: nullableString(row['created_by']),
  updated_by: nullableString(row['updated_by']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at'])
});

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
};

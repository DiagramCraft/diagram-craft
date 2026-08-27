import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import type { SharedFieldGroupLink, ValidationRule } from '@arch-register/api-types/schemaContract';
import type { ExternalMetadata } from '@arch-register/api-types/common';
import { databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

type RelationValidationDiagnostic = {
  ruleId: string;
  relationId: string;
  schemaId: string;
  schemaVersion: number;
  severity: 'error' | 'warning';
  message: string;
  fieldId?: string;
};

type RelationValidationResult = {
  relationId: string;
  schemaId: string;
  schemaVersion: number;
  errors: RelationValidationDiagnostic[];
  warnings: RelationValidationDiagnostic[];
};

// -- Relation Schema

export type RelationSchemaGroupDbShape = {
  id: string;
  name: string;
  description?: string;
  accessControl?: { teamIds: string[] };
};

export type RelationSchemaDbResult = {
  id: string;
  workspace: string;
  name: string;
  category?: string | null;
  description: string;
  in_schema_ids: string[] | 'any';
  out_schema_ids: string[] | 'any';
  in_label?: string | null;
  out_label?: string | null;
  fields: RelationField[];
  groups?: RelationSchemaGroupDbShape[];
  shared_field_group_links?: SharedFieldGroupLink[];
  validation_rules?: ValidationRule[];
  color: string | null;
  icon: string | null;
  relation_approval_policy?: 'required' | 'disabled';
  /** Defaults to 1 on create; omit on update to leave the current version unchanged. */
  version?: number;
  created_at: Date;
  updated_at: Date;
};

export type RelationSchemaDbCreate = RelationSchemaDbResult;

export type RelationSchemaDbUpdate = Omit<
  RelationSchemaDbResult,
  'id' | 'workspace' | 'created_at'
>;

// -- Relation Schema Version

export type RelationSchemaVersionDbResult = {
  id: string;
  workspace: string;
  schema_id: string;
  version: number;
  name: string;
  category?: string | null;
  description: string;
  in_schema_ids: string[] | 'any';
  out_schema_ids: string[] | 'any';
  in_label?: string | null;
  out_label?: string | null;
  fields: RelationField[];
  groups: RelationSchemaGroupDbShape[];
  validation_rules?: ValidationRule[];
  color: string | null;
  icon: string | null;
  change_summary: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
};

export type RelationSchemaVersionDbCreate = RelationSchemaVersionDbResult;

const parseRelationSchemaIds = (value: unknown, field: string): string[] | 'any' =>
  value === 'any' ? 'any' : parseDatabaseJson<string[] | 'any'>(value, [], field);

// -- Relation instance

export const RELATION_SELECT_SQL = `
  SELECT r.*,
    r.in_record_id  AS in_entity_id,
    r.out_record_id AS out_entity_id,
    ein.name  AS in_entity_name,
    eout.name AS out_entity_name,
    ein.schema_id AS in_entity_schema_id,
    eout.schema_id AS out_entity_schema_id,
    rs.name   AS schema_name,
    wo.name   AS owner_name,
    ls.label  AS lifecycle_label
  FROM catalog_record r
  JOIN catalog_record ein ON ein.id  = r.in_record_id  AND ein.kind = 'entity'
    AND r.kind = 'relation' AND r.deleted_at IS NULL
  JOIN catalog_record eout ON eout.id = r.out_record_id AND eout.kind = 'entity'
  JOIN relation_schema rs ON rs.id   = r.schema_id
  LEFT JOIN workspace_owner wo           ON wo.id = r.owner
  LEFT JOIN workspace_lifecycle_state ls ON ls.id = r.lifecycle
`;

export type RelationDbResult = {
  id: string;
  workspace: string;
  schema_id: string;
  schema_name: string;
  in_entity_id: string;
  in_entity_name: string;
  in_entity_schema_id?: string;
  out_entity_id: string;
  out_entity_name: string;
  out_entity_schema_id?: string;
  data: Record<string, unknown>;
  owner: string | null;
  owner_name: string | null;
  lifecycle: string | null;
  lifecycle_label: string | null;
  version: number;
  approval_policy_override: 'required' | 'disabled' | null;
  generated_metadata?: ExternalMetadata;
  created_at: Date;
  updated_at: Date;
  validation?: RelationValidationResult;
};

// Row shape produced by a compiled relation-rooted EntityQuery (entityQueryIRCompiler.ts):
// the same denormalized shape as RelationDbResult, plus the query's projections object.
export type RelationQueryDbResult = RelationDbResult & {
  projections: Record<string, unknown>;
};

export type RelationDbCreate = {
  id: string;
  workspace: string;
  schema_id: string;
  in_entity_id: string;
  out_entity_id: string;
  data: Record<string, unknown>;
  /** Omit to leave unowned (e.g. seed/import/chat-tool creation paths); the primary
   *  createWorkspaceRelation flow always supplies this, copied from the "in" entity's owner. */
  owner?: string | null;
  lifecycle?: string | null;
  version?: number;
  approval_policy_override?: 'required' | 'disabled' | null;
  created_at: Date;
  updated_at: Date;
};

export type RelationDbUpdate = {
  data: Record<string, unknown>;
  version: number;
  /** undefined = leave unchanged (most callers — automation, AI tools, field mutations, CSV
   *  import — never touch ownership); null = explicitly clear; a string = set to that owner. */
  owner?: string | null;
  lifecycle?: string | null;
  approval_policy_override?: 'required' | 'disabled' | null;
  updated_at: Date;
};

export type RelationListDbFilters = {
  schemaId?: string | null;
  inEntityId?: string | null;
  outEntityId?: string | null;
};

export type RelationListDbPagination = {
  limit?: number | null;
  offset?: number | null;
};

export const relationMappers = {
  relationSchema: (row: DatabaseRow): RelationSchemaDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    category: row['category'] == null ? null : String(row['category']),
    description: String(row['description'] ?? ''),
    in_schema_ids: parseRelationSchemaIds(row['in_schema_ids'], 'relation_schema.in_schema_ids'),
    out_schema_ids: parseRelationSchemaIds(row['out_schema_ids'], 'relation_schema.out_schema_ids'),
    in_label: row['in_label'] == null ? null : String(row['in_label']),
    out_label: row['out_label'] == null ? null : String(row['out_label']),
    fields: parseDatabaseJson(row['fields'], [], 'relation_schema.fields'),
    groups: parseDatabaseJson(row['groups'], [], 'relation_schema.groups'),
    shared_field_group_links: parseDatabaseJson(
      row['shared_field_group_links'],
      [],
      'relation_schema.shared_field_group_links'
    ),
    validation_rules: parseDatabaseJson(
      row['validation_rules'],
      [],
      'relation_schema.validation_rules'
    ),
    color: row['color'] == null ? null : String(row['color']),
    icon: row['icon'] == null ? null : String(row['icon']),
    relation_approval_policy: String(
      row['relation_approval_policy'] ?? 'disabled'
    ) as RelationSchemaDbResult['relation_approval_policy'],
    version: Number(row['version'] ?? 1),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  relationSchemaVersion: (row: DatabaseRow): RelationSchemaVersionDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    schema_id: String(row['schema_id']),
    version: Number(row['version']),
    name: String(row['name']),
    category: row['category'] == null ? null : String(row['category']),
    description: String(row['description'] ?? ''),
    in_schema_ids: parseRelationSchemaIds(
      row['in_schema_ids'],
      'relation_schema_version.in_schema_ids'
    ),
    out_schema_ids: parseRelationSchemaIds(
      row['out_schema_ids'],
      'relation_schema_version.out_schema_ids'
    ),
    in_label: row['in_label'] == null ? null : String(row['in_label']),
    out_label: row['out_label'] == null ? null : String(row['out_label']),
    fields: parseDatabaseJson(row['fields'], [], 'relation_schema_version.fields'),
    groups: parseDatabaseJson(row['groups'], [], 'relation_schema_version.groups'),
    validation_rules: parseDatabaseJson(
      row['validation_rules'],
      [],
      'relation_schema_version.validation_rules'
    ),
    color: row['color'] == null ? null : String(row['color']),
    icon: row['icon'] == null ? null : String(row['icon']),
    change_summary: parseDatabaseJson(
      row['change_summary'],
      {},
      'relation_schema_version.change_summary'
    ),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    created_at: databaseDate(row['created_at'])
  }),
  relation: (row: DatabaseRow): RelationDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    schema_id: String(row['schema_id']),
    schema_name: String(row['schema_name']),
    in_entity_id: String(row['in_entity_id']),
    in_entity_name: String(row['in_entity_name']),
    in_entity_schema_id:
      row['in_entity_schema_id'] == null ? undefined : String(row['in_entity_schema_id']),
    out_entity_id: String(row['out_entity_id']),
    out_entity_name: String(row['out_entity_name']),
    out_entity_schema_id:
      row['out_entity_schema_id'] == null ? undefined : String(row['out_entity_schema_id']),
    data: parseDatabaseJson(row['data'], {}, 'relation.data'),
    owner: row['owner'] == null ? null : String(row['owner']),
    owner_name: row['owner_name'] == null ? null : String(row['owner_name']),
    lifecycle: row['lifecycle'] == null ? null : String(row['lifecycle']),
    lifecycle_label: row['lifecycle_label'] == null ? null : String(row['lifecycle_label']),
    version: Number(row['version'] ?? 1),
    approval_policy_override:
      row['approval_policy_override'] == null
        ? null
        : (String(row['approval_policy_override']) as RelationDbResult['approval_policy_override']),
    generated_metadata: parseDatabaseJson<ExternalMetadata>(
      row['generated_metadata'],
      {},
      'relation.generated_metadata'
    ),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  relationQuery: (row: DatabaseRow): RelationQueryDbResult => ({
    ...relationMappers.relation(row),
    projections: parseDatabaseJson<Record<string, unknown>>(
      row['projections'],
      {},
      'relation_query.projections'
    )
  })
};

export type RelationDatabase = {
  listRelationSchemas(ws: string): Promise<RelationSchemaDbResult[]>;
  getRelationSchema(ws: string, id: string): Promise<RelationSchemaDbResult | null>;
  createRelationSchema(input: RelationSchemaDbCreate): Promise<RelationSchemaDbResult>;
  updateRelationSchema(
    ws: string,
    id: string,
    input: RelationSchemaDbUpdate
  ): Promise<RelationSchemaDbResult | null>;
  deleteRelationSchema(ws: string, id: string): Promise<RelationSchemaDbResult | null>;

  listRelationSchemaVersions(
    ws: string,
    schemaId: string
  ): Promise<RelationSchemaVersionDbResult[]>;
  createRelationSchemaVersion(
    input: RelationSchemaVersionDbCreate
  ): Promise<RelationSchemaVersionDbResult>;

  renameRelationDataField(
    ws: string,
    schemaId: string,
    oldFieldId: string,
    newFieldId: string
  ): Promise<number>;
  removeRelationDataField(ws: string, schemaId: string, fieldId: string): Promise<number>;

  countRelationsForSchema(ws: string, schemaId: string): Promise<number>;

  // Runs a relation-rooted query compiled by entityQueryIRCompiler.ts's compileEntityQueryIR
  // (root_kind resolves to 'relation'). Dialect-generic raw SQL execution, mirroring
  // CatalogDatabase.runCompiledEntityQuery — the SQL text already encodes all filtering.
  runCompiledRelationQuery(sql: string, params: unknown[]): Promise<RelationQueryDbResult[]>;

  // Runs a `SELECT COUNT(*)` compiled by entityQueryIRCompiler.ts's compileEntityQueryCountIR —
  // the total-row companion to runCompiledRelationQuery used for paginated relation queries (#2700).
  runCompiledRelationCountQuery(sql: string, params: unknown[]): Promise<number>;

  listRelations(
    ws: string,
    filters: RelationListDbFilters,
    pagination: RelationListDbPagination
  ): Promise<{ items: RelationDbResult[]; total: number }>;
  getRelation(ws: string, id: string): Promise<RelationDbResult | null>;
  createRelation(input: RelationDbCreate): Promise<RelationDbResult>;
  updateRelation(ws: string, id: string, input: RelationDbUpdate): Promise<RelationDbResult | null>;
  /**
   * System-maintained derived-field recompute only (relation create/update, carried/endpoint
   * entity change, schema edit). Does not bump `version` or `updated_at` and creates no
   * record_version snapshot, mirroring `updateEntityDerivedFields`.
   */
  updateRelationDerivedFields(ws: string, id: string, data: Record<string, unknown>): Promise<void>;
  deleteRelation(ws: string, id: string): Promise<RelationDbResult | null>;

  listRelationsForEntity(
    ws: string,
    entityId: string
  ): Promise<{ outgoing: RelationDbResult[]; incoming: RelationDbResult[] }>;

  /**
   * Batch form of listRelationsForEntity: `outgoing` holds every relation where the "in" endpoint
   * is one of `entityIds`, `incoming` holds every relation where the "out" endpoint is one of
   * `entityIds` — callers regroup per entity id themselves. Used by getBatchEntityRelations to
   * avoid an N+1 query per entity in the graph/matrix/explore views.
   */
  listRelationsForEntities(
    ws: string,
    entityIds: string[]
  ): Promise<{ outgoing: RelationDbResult[]; incoming: RelationDbResult[] }>;
};

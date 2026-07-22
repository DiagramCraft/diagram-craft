import {
  BrowserView,
  BubbleViewConfig,
  CardsViewConfig,
  EntityFilters,
  ExploreViewConfig,
  FilterCondition,
  MapViewConfig,
  MatrixViewConfig,
  RadarViewConfig,
  TableViewConfig,
  TimelineViewConfig,
  TreeViewConfig
} from '@arch-register/api-types/viewContract';
import { EntityTemplate, SchemaField } from '@arch-register/api-types/schemaContract';
import { EntityLink } from '@arch-register/api-types/entityContract';
import type { EntityRole } from '@arch-register/permissions';
import type { ExternalMetadata } from '@arch-register/api-types/common';
import {
  databaseDate,
  databaseDateOnly,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';
import { ENTITY_DEFAULTS } from '../../../constants';

export const ENTITY_SELECT_SQL = `
  SELECT e.*,
    wo.name   AS owner_name,
    ls.label  AS lifecycle_label,
    tls.label AS target_lifecycle_label,
    es.name   AS schema_name
  FROM entity e
  LEFT JOIN workspace_owner wo            ON wo.id  = e.owner
  LEFT JOIN workspace_lifecycle_state ls  ON ls.id  = e.lifecycle
  LEFT JOIN workspace_lifecycle_state tls ON tls.id = e.target_lifecycle
  JOIN entity_schema es ON es.id = e.schema_id
`;

export const ENTITY_SNAPSHOT_SELECT_SQL = `
  SELECT s.*, u.display_name as created_by_name
  FROM entity_snapshot s
  LEFT JOIN users u ON u.id = s.created_by
`;

export type EntityListDbFilters = {
  schemaId?: string | null;
  owner?: string | null;
  lifecycle?: string | null;
  q?: string | null;
  conditions?: FilterCondition[];
  // Scopes results by entity.project_id (entities created solely for one project). 'all' (the
  // default) excludes project-exclusive entities entirely — matching global-query semantics.
  // 'project' includes only entities whose project_id matches `projectId`.
  projectId?: string | null;
  projectScope?: 'project' | 'all';
};

export type EntityListDbPagination = {
  limit?: number | null;
  offset?: number | null;
};

export const resolveEntityListPagination = (pagination?: EntityListDbPagination) => {
  const limit = pagination?.limit ?? ENTITY_DEFAULTS.PAGE_SIZE;
  const offset = pagination?.offset ?? 0;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`Invalid pagination limit: ${limit}`);
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(`Invalid pagination offset: ${offset}`);
  }
  return { limit, offset };
};

// -- Entity Schema

export type SchemaDbResult = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  fields: SchemaField[];
  templates?: EntityTemplate[];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  key_prefix: string;
  /** Defaults to 1 on create; omit on update to leave the current version unchanged. */
  version?: number;
  entity_approval_policy?: 'required' | 'disabled';
  deprecation_policy?: 'required' | 'disabled';
  created_at: Date;
  updated_at: Date;
};

export type SchemaDbCreate = SchemaDbResult;

export type SchemaDbUpdate = Omit<SchemaDbResult, 'id' | 'workspace' | 'created_at'>;

// -- Entity Schema Version

export type SchemaVersionDbResult = {
  id: string;
  workspace: string;
  schema_id: string;
  version: number;
  name: string;
  description: string;
  fields: SchemaField[];
  templates: EntityTemplate[];
  color: string | null;
  icon: string | null;
  change_summary: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
};

export type SchemaVersionDbCreate = SchemaVersionDbResult;

// -- Workspace Enum

export type WorkspaceEnumDbResult = {
  id: string;
  workspace: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type WorkspaceEnumDbCreate = WorkspaceEnumDbResult;

export type WorkspaceEnumDbUpdate = Omit<WorkspaceEnumDbResult, 'id' | 'workspace' | 'created_at'>;

// -- Entity Grant

export type EntityGrantDbResult = {
  id: string;
  workspace: string;
  entity_id: string;
  principal_type: 'user' | 'team';
  principal_id: string;
  role: EntityRole;
  applies_to: EntityGrantScope;
  created_at: Date;
};

type EntityGrantScope = 'self' | 'subtree';

export type EntityGrantDbCretae = EntityGrantDbResult;

// -- User Pinned Entity

export type PinnedEntityDbResult = {
  user_id: string;
  workspace: string;
  entity_id: string;
  created_at: Date;
};

export type PinnedEntityDbCreate = PinnedEntityDbResult;

// -- Entity

export type Entity = {
  id: string;
  workspace: string;
  public_id: string;
  slug: string;
  namespace: string;
  name: string;
  description: string;
  owner: string | null;
  lifecycle: string | null;
  target_lifecycle: string | null;
  target_lifecycle_date: string | null;
  tags: string[];
  links: EntityLink[];
  schema_id: string;
  data: Record<string, unknown>;
  // Latest external-update result per field id, for fields whose schema definition carries
  // `external_kind`. Keyed by field id; latest result only, no history. Always populated (as
  // `{}` if empty) when read from the database; optional here mainly so existing in-memory
  // fixtures/constructors that predate this field don't all need updating.
  generated_metadata?: ExternalMetadata;
  // Set only when this entity was created solely for one project — it should not appear outside
  // that project's context. Distinct from project_entity, which associates an existing,
  // otherwise-normal entity with a project without restricting its general visibility.
  project_id: string | null;
  created_at: Date;
  updated_at: Date;
  version?: number;
  approval_policy_override?: 'required' | 'disabled' | null;
};

// Entity enriched with resolved names from joined tables (owner, lifecycle, schema).
// Returned by listEntities / getEntity; used by helpers that build API responses.
export type EntityDbResult = Entity & {
  owner_name: string | null;
  lifecycle_label: string | null;
  target_lifecycle_label: string | null;
  schema_name: string;
};

export type EntityQueryDbResult = EntityDbResult & {
  projections: Record<string, unknown>;
};

export type EntityDbCreate = Omit<Entity, 'version' | 'approval_policy_override'> & {
  version?: number;
  approval_policy_override?: 'required' | 'disabled' | null;
  // Defaults to {} (a newly created entity starts with no external metadata).
  generated_metadata?: ExternalMetadata;
};

export type EntityDbUpdate = Omit<
  Entity,
  'id' | 'workspace' | 'public_id' | 'created_at' | 'version'
> & {
  version?: number;
  // Omit to leave the stored value untouched (the common case for a plain field update);
  // pass explicitly to write a new value (e.g. when outdating or applying an external update).
  generated_metadata?: ExternalMetadata;
};

// -- Entity versions and compatibility projections

export type EntityVersionKind =
  | 'autosave'
  | 'saved_version'
  | 'deleted'
  | 'restored'
  | 'direct_edit'
  | 'case_applied'
  | 'bypass';

export type EntityVersionDbResult = {
  id: string;
  workspace: string;
  entity_id: string;
  version_number: number;
  kind: EntityVersionKind;
  commit_message: string | null;
  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;
  state: Record<string, unknown>;
  applied_case_revision_id: string | null;
};

export type EntityVersionDbCreate = Omit<EntityVersionDbResult, 'created_by_name'>;

export type SnapshotStatus = 'autosave' | 'saved_version' | 'future_update' | 'applied' | 'deleted';

export type EntitySnapshotDbResult = {
  id: string;
  workspace: string;
  entity_id: string;
  status: SnapshotStatus;
  project_id: string | null;
  target_date: string | null;
  milestone_id: string | null;
  commit_message: string | null;
  created_at: Date;
  created_by: string;
  created_by_name: string | null;
  base_state: Record<string, unknown>;
  proposed_state: Record<string, unknown> | null;
  /** Target-model identity for future/applied compatibility projections. */
  case_id?: string | null;
  case_revision_id?: string | null;
};

export type EntitySnapshotDbCreate = EntitySnapshotDbResult & {
  version_kind?: EntityVersionKind;
  applied_case_revision_id?: string | null;
};

export type TimelineMarkerDbResult = {
  date: string;
  type: 'future_update' | 'saved_version' | 'applied';
  count: number;
};

export const catalogMappers = {
  enrichedEntity: (row: DatabaseRow): EntityDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    public_id: String(row['public_id']),
    slug: String(row['slug']),
    namespace: String(row['namespace']),
    name: String(row['name']),
    description: String(row['description']),
    owner: row['owner'] == null ? null : String(row['owner']),
    lifecycle: row['lifecycle'] == null ? null : String(row['lifecycle']),
    target_lifecycle: row['target_lifecycle'] == null ? null : String(row['target_lifecycle']),
    target_lifecycle_date:
      row['target_lifecycle_date'] == null ? null : String(row['target_lifecycle_date']),
    tags: parseDatabaseJson<string[]>(row['tags'], [], 'entity.tags'),
    links: parseDatabaseJson<EntityLink[]>(row['links'], [], 'entity.links'),
    schema_id: String(row['schema_id']),
    data: parseDatabaseJson<Record<string, unknown>>(row['data'], {}, 'entity.data'),
    generated_metadata: parseDatabaseJson<ExternalMetadata>(
      row['generated_metadata'],
      {},
      'entity.generated_metadata'
    ),
    project_id: row['project_id'] == null ? null : String(row['project_id']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    owner_name: row['owner_name'] == null ? null : String(row['owner_name']),
    lifecycle_label: row['lifecycle_label'] == null ? null : String(row['lifecycle_label']),
    target_lifecycle_label:
      row['target_lifecycle_label'] == null ? null : String(row['target_lifecycle_label']),
    schema_name: String(row['schema_name']),
    version: Number(row['version'] ?? 1),
    approval_policy_override:
      row['approval_policy_override'] == null
        ? null
        : (String(row['approval_policy_override']) as Entity['approval_policy_override'])
  }),
  entityQuery: (row: DatabaseRow): EntityQueryDbResult => ({
    ...catalogMappers.enrichedEntity(row),
    projections: parseDatabaseJson<Record<string, unknown>>(
      row['projections'],
      {},
      'entity_query.projections'
    )
  }),
  entitySnapshot: (row: DatabaseRow): EntitySnapshotDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    status: String(row['status']) as EntitySnapshotDbResult['status'],
    project_id: row['project_id'] == null ? null : String(row['project_id']),
    target_date: row['target_date'] == null ? null : databaseDateOnly(row['target_date']),
    milestone_id: row['milestone_id'] == null ? null : String(row['milestone_id']),
    commit_message: row['commit_message'] == null ? null : String(row['commit_message']),
    created_at: databaseDate(row['created_at']),
    created_by: String(row['created_by']),
    created_by_name: row['created_by_name'] == null ? null : String(row['created_by_name']),
    base_state: parseDatabaseJson<Record<string, unknown>>(
      row['base_state'],
      {},
      'entity_snapshot.base_state'
    ),
    proposed_state:
      row['proposed_state'] == null
        ? null
        : parseDatabaseJson<Record<string, unknown>>(
            row['proposed_state'],
            {},
            'entity_snapshot.proposed_state'
          ),
    case_id: row['case_id'] == null ? null : String(row['case_id']),
    case_revision_id: row['case_revision_id'] == null ? null : String(row['case_revision_id'])
  }),
  entityVersion: (row: DatabaseRow): EntityVersionDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    version_number: Number(row['version_number']),
    kind: row['kind'] as EntityVersionKind,
    commit_message: row['commit_message'] == null ? null : String(row['commit_message']),
    created_at: databaseDate(row['created_at']),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    created_by_name: row['created_by_name'] == null ? null : String(row['created_by_name']),
    state: parseDatabaseJson<Record<string, unknown>>(row['state'], {}, 'entity_version.state'),
    applied_case_revision_id:
      row['applied_case_revision_id'] == null ? null : String(row['applied_case_revision_id'])
  }),
  pinnedEntity: (row: DatabaseRow): PinnedEntityDbResult => ({
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    created_at: databaseDate(row['created_at'])
  }),
  schema: (row: DatabaseRow): SchemaDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    description: String(row['description'] ?? ''),
    fields: parseDatabaseJson(row['fields'], [], 'entity_schema.fields'),
    templates: parseDatabaseJson(row['templates'], [], 'entity_schema.templates'),
    color: row['color'] == null ? null : String(row['color']),
    icon: row['icon'] == null ? null : String(row['icon']),
    default_owner: row['default_owner'] == null ? null : String(row['default_owner']),
    key_prefix: String(row['key_prefix']),
    version: Number(row['version'] ?? 1),
    entity_approval_policy: String(
      row['entity_approval_policy'] ?? 'disabled'
    ) as SchemaDbResult['entity_approval_policy'],
    deprecation_policy: String(
      row['deprecation_policy'] ?? 'disabled'
    ) as SchemaDbResult['deprecation_policy'],
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  schemaVersion: (row: DatabaseRow): SchemaVersionDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    schema_id: String(row['schema_id']),
    version: Number(row['version']),
    name: String(row['name']),
    description: String(row['description'] ?? ''),
    fields: parseDatabaseJson(row['fields'], [], 'entity_schema_version.fields'),
    templates: parseDatabaseJson(row['templates'], [], 'entity_schema_version.templates'),
    color: row['color'] == null ? null : String(row['color']),
    icon: row['icon'] == null ? null : String(row['icon']),
    change_summary: parseDatabaseJson(
      row['change_summary'],
      {},
      'entity_schema_version.change_summary'
    ),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    created_at: databaseDate(row['created_at'])
  }),
  workspaceEnum: (row: DatabaseRow): WorkspaceEnumDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    options: parseDatabaseJson(row['options'], [], 'workspace_enum.options'),
    sort_order: Number(row['sort_order'] ?? 0),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  entityGrant: (row: DatabaseRow): EntityGrantDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    principal_type: String(row['principal_type']) as EntityGrantDbResult['principal_type'],
    principal_id: String(row['principal_id']),
    role: String(row['role']) as EntityGrantDbResult['role'],
    applies_to: String(row['applies_to']) as EntityGrantDbResult['applies_to'],
    created_at: databaseDate(row['created_at'])
  }),
  collection: (row: DatabaseRow): CollectionDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    user_id: String(row['user_id']),
    name: String(row['name']),
    entity_count: Number(row['entity_count'] ?? 0),
    is_member:
      row['is_member'] == null
        ? undefined
        : row['is_member'] === true || row['is_member'] === 1 || row['is_member'] === '1',
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  collectionEntity: (row: DatabaseRow): CollectionEntityDbResult => ({
    collection_id: String(row['collection_id']),
    entity_id: String(row['entity_id']),
    created_at: databaseDate(row['created_at'])
  }),
  savedView: (row: DatabaseRow): SavedViewDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    project_id: row['project_id'] == null ? null : String(row['project_id']),
    project_scope:
      row['project_scope'] == null ? null : (String(row['project_scope']) as 'project' | 'all'),
    name: String(row['name']),
    description: row['description'] == null ? null : String(row['description']),
    is_admin_view:
      row['is_admin_view'] === true || row['is_admin_view'] === 1 || row['is_admin_view'] === '1',
    view_mode: String(row['view_mode']) as SavedViewDbResult['view_mode'],
    filters: parseDatabaseJson(row['filters'], {}, 'saved_view.filters'),
    config: parseDatabaseJson(row['config'], null, 'saved_view.config'),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  })
};

export type CatalogDatabase = {
  resolveWorkspaceSlug(slug: string): Promise<string | null>;

  listSchemas(ws: string): Promise<SchemaDbResult[]>;
  getSchema(ws: string, id: string): Promise<SchemaDbResult | null>;
  getSchemaByKeyPrefix(prefix: string): Promise<SchemaDbResult | null>;
  createSchema(input: SchemaDbCreate): Promise<SchemaDbResult>;
  updateSchema(ws: string, id: string, input: SchemaDbUpdate): Promise<SchemaDbResult | null>;
  deleteSchema(ws: string, id: string): Promise<SchemaDbResult | null>;

  listSchemaVersions(ws: string, schemaId: string): Promise<SchemaVersionDbResult[]>;
  createSchemaVersion(input: SchemaVersionDbCreate): Promise<SchemaVersionDbResult>;

  renameEntityDataField(
    ws: string,
    schemaId: string,
    oldFieldId: string,
    newFieldId: string
  ): Promise<number>;
  removeEntityDataField(ws: string, schemaId: string, fieldId: string): Promise<number>;

  listEnums(ws: string): Promise<WorkspaceEnumDbResult[]>;
  getEnum(ws: string, id: string): Promise<WorkspaceEnumDbResult | null>;
  createEnum(input: WorkspaceEnumDbCreate): Promise<WorkspaceEnumDbResult>;
  updateEnum(
    ws: string,
    id: string,
    input: WorkspaceEnumDbUpdate
  ): Promise<WorkspaceEnumDbResult | null>;
  deleteEnum(ws: string, id: string): Promise<WorkspaceEnumDbResult | null>;

  listEntitiesPaginated(
    ws: string,
    filters?: EntityListDbFilters,
    pagination?: EntityListDbPagination
  ): Promise<EntityDbResult[]>;
  // Runs a pre-compiled structured EntityQuery (see entityQueryIRCompiler.ts), returning the
  // matched entity plus any requested projection values. The method is also the cross-driver
  // execution seam used by compiler contract tests before endpoint wiring lands.
  runCompiledEntityQuery(sql: string, params: unknown[]): Promise<EntityQueryDbResult[]>;
  listEntities(ws: string): Promise<EntityDbResult[]>;
  getEntity(ws: string, identifier: string): Promise<EntityDbResult | null>;
  createEntity(input: EntityDbCreate): Promise<EntityDbResult>;
  updateEntity(ws: string, id: string, input: EntityDbUpdate): Promise<EntityDbResult | null>;
  updateEntityIfVersion(
    ws: string,
    id: string,
    input: EntityDbUpdate,
    expectedVersion: number
  ): Promise<EntityDbResult | null>;
  setEntityApprovalPolicyOverride(
    ws: string,
    id: string,
    override: 'required' | 'disabled' | null
  ): Promise<EntityDbResult | null>;
  deleteEntity(ws: string, id: string): Promise<Entity | null>;

  createEntityVersion(input: EntityVersionDbCreate): Promise<EntityVersionDbResult>;
  listEntityVersions(ws: string, entityId: string): Promise<EntityVersionDbResult[]>;
  listEntityVersionsAsOf(
    ws: string,
    asOf: Date,
    entityIds?: string[]
  ): Promise<EntityVersionDbResult[]>;
  updateEntityVersionKind(
    ws: string,
    versionId: string,
    kind: EntityVersionKind,
    commitMessage: string | null
  ): Promise<EntityVersionDbResult | null>;

  listEntityGrants(ws: string): Promise<EntityGrantDbResult[]>;
  getEntityGrants(ws: string, entityId: string): Promise<EntityGrantDbResult[]>;
  replaceEntityGrants(
    ws: string,
    entityId: string,
    grants: EntityGrantDbCretae[]
  ): Promise<EntityGrantDbResult[]>;

  listPinnedEntities(userId: string, workspace: string): Promise<PinnedEntityDbResult[]>;
  getPinnedEntity(
    userId: string,
    workspace: string,
    entityId: string
  ): Promise<PinnedEntityDbResult | null>;
  createPinnedEntity(input: PinnedEntityDbCreate): Promise<PinnedEntityDbResult>;
  deletePinnedEntity(
    userId: string,
    workspace: string,
    entityId: string
  ): Promise<PinnedEntityDbResult | null>;

  createSnapshot(input: EntitySnapshotDbCreate): Promise<EntitySnapshotDbResult>;
  getSnapshot(ws: string, snapshotId: string): Promise<EntitySnapshotDbResult | null>;
  listSnapshots(ws: string, entityId: string): Promise<EntitySnapshotDbResult[]>;
  listSnapshotsByProject(ws: string, projectId: string): Promise<EntitySnapshotDbResult[]>;
  listSnapshotsAsOf(
    ws: string,
    asOf: Date,
    entityIds?: string[]
  ): Promise<EntitySnapshotDbResult[]>;
  listTimelineMarkers(ws: string): Promise<TimelineMarkerDbResult[]>;
  listEntityIdsWithAnySnapshot(ws: string, entityIds?: string[]): Promise<string[]>;
  pruneAutosaveSnapshots(ws: string, entityId: string, keepCount: number): Promise<void>;
  promoteSnapshot(
    ws: string,
    snapshotId: string,
    commitMessage: string | null
  ): Promise<EntitySnapshotDbResult | null>;
  updateSnapshot(
    ws: string,
    snapshotId: string,
    updates: {
      proposed_state?: Record<string, unknown>;
      target_date?: string | null;
      milestone_id?: string | null;
      commit_message?: string | null;
    }
  ): Promise<EntitySnapshotDbResult | null>;
  deleteSnapshot(ws: string, snapshotId: string): Promise<EntitySnapshotDbResult | null>;
  applySnapshot(ws: string, snapshotId: string): Promise<EntitySnapshotDbResult | null>;
  reassignSnapshotsFromMilestone(
    ws: string,
    milestoneId: string,
    backfillTargetDate: string | null
  ): Promise<void>;
  updateChangeCaseEffectiveDateForMilestone(
    ws: string,
    milestoneId: string,
    effectiveDate: string | null
  ): Promise<void>;
};

// -- Saved View

export type SavedViewDbResult = {
  id: string;
  workspace: string;
  project_id: string | null;
  project_scope: 'project' | 'all' | null;
  name: string;
  description: string | null;
  is_admin_view: boolean;
  view_mode: BrowserView;
  filters: EntityFilters;
  config: {
    table?: TableViewConfig;
    cards?: CardsViewConfig;
    tree?: TreeViewConfig;
    radar?: RadarViewConfig;
    timeline?: TimelineViewConfig;
    matrix?: MatrixViewConfig;
    explore?: ExploreViewConfig;
    bubble?: BubbleViewConfig;
    map?: MapViewConfig;
  } | null;
  created_at: Date;
  updated_at: Date;
};

export type SavedViewDbCreate = SavedViewDbResult;

export type SavedViewDbUpdate = Partial<
  Omit<SavedViewDbResult, 'id' | 'workspace' | 'created_at' | 'updated_at'>
> & {
  updated_at: Date;
};

// -- Personal Collection

export type CollectionDbResult = {
  id: string;
  workspace: string;
  user_id: string;
  name: string;
  entity_count: number;
  is_member?: boolean;
  created_at: Date;
  updated_at: Date;
};

export type CollectionDbCreate = Omit<CollectionDbResult, 'entity_count' | 'is_member'>;
export type CollectionDbUpdate = { name: string; updated_at: Date };

export type CollectionEntityDbResult = {
  collection_id: string;
  entity_id: string;
  created_at: Date;
};

export type ViewDatabase = {
  listSavedViews(
    ws: string,
    options?: {
      projectId?: string | null;
      includeWorkspace?: boolean;
    }
  ): Promise<SavedViewDbResult[]>;
  getSavedView(ws: string, id: string): Promise<SavedViewDbResult | null>;
  createSavedView(input: SavedViewDbCreate): Promise<SavedViewDbResult>;
  updateSavedView(
    ws: string,
    id: string,
    input: SavedViewDbUpdate
  ): Promise<SavedViewDbResult | null>;
  deleteSavedView(ws: string, id: string): Promise<SavedViewDbResult | null>;

  listCollections(userId: string, ws: string, entityId?: string): Promise<CollectionDbResult[]>;
  getCollection(userId: string, ws: string, id: string): Promise<CollectionDbResult | null>;
  createCollection(input: CollectionDbCreate): Promise<CollectionDbResult>;
  updateCollection(
    userId: string,
    ws: string,
    id: string,
    input: CollectionDbUpdate
  ): Promise<CollectionDbResult | null>;
  deleteCollection(userId: string, ws: string, id: string): Promise<CollectionDbResult | null>;
  addCollectionEntity(
    userId: string,
    ws: string,
    collectionId: string,
    entityId: string,
    createdAt: Date
  ): Promise<CollectionEntityDbResult>;
  removeCollectionEntity(
    userId: string,
    ws: string,
    collectionId: string,
    entityId: string
  ): Promise<CollectionEntityDbResult | null>;
  listCollectionEntityIds(userId: string, ws: string, collectionId: string): Promise<string[]>;
};

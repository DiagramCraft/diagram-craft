import {
  BrowserView,
  EntityFilters,
  ExploreViewConfig,
  FilterCondition,
  HierarchyViewConfig,
  MatrixViewConfig,
  RadarViewConfig,
  TimelineViewConfig
} from '@arch-register/api-types/viewContract';

export type EntityListDbFilters = {
  schemaId?: string | null;
  owner?: string | null;
  lifecycle?: string | null;
  q?: string | null;
  conditions?: FilterCondition[];
};
import { SchemaField } from '@arch-register/api-types/schemaContract';
import { EntityLink, VisibilityMode } from '@arch-register/api-types/entityContract';

// -- Entity Schema

export type SchemaDbResult = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  fields: SchemaField[];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  key_prefix: string;
  created_at: Date;
  updated_at: Date;
};

export type SchemaDbCreate = SchemaDbResult;

export type SchemaDbUpdate = Omit<SchemaDbResult, 'id' | 'workspace' | 'created_at'>;

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

type EntityRole = 'viewer' | 'editor' | 'contributor' | 'entity_admin';

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
  visibility_mode: VisibilityMode | null;
  created_at: Date;
  updated_at: Date;
};

// Entity enriched with resolved names from joined tables (owner, lifecycle, schema).
// Returned by listEntities / getEntity; used by helpers that build API responses.
export type EntityDbResult = Entity & {
  owner_name: string | null;
  lifecycle_label: string | null;
  target_lifecycle_label: string | null;
  schema_name: string;
};

export type EntityDbCreate = Entity;

export type EntityDbUpdate = Omit<Entity, 'id' | 'workspace' | 'public_id' | 'created_at'>;

// -- Entity Snapshot

export type SnapshotStatus = 'autosave' | 'saved_version' | 'future_update' | 'applied';

export type EntitySnapshotDbResult = {
  id: string;
  workspace: string;
  entity_id: string;
  status: SnapshotStatus;
  project_id: string | null;
  target_date: string | null;
  commit_message: string | null;
  created_at: Date;
  created_by: string;
  created_by_name: string | null;
  base_state: Record<string, unknown>;
  proposed_state: Record<string, unknown> | null;
};

export type EntitySnapshotDbCreate = EntitySnapshotDbResult;

export type CatalogDatabase = {
  resolveWorkspaceSlug(slug: string): Promise<string | null>;

  listSchemas(ws: string): Promise<SchemaDbResult[]>;
  getSchema(ws: string, id: string): Promise<SchemaDbResult | null>;
  getSchemaByKeyPrefix(prefix: string): Promise<SchemaDbResult | null>;
  createSchema(input: SchemaDbCreate): Promise<SchemaDbResult>;
  updateSchema(ws: string, id: string, input: SchemaDbUpdate): Promise<SchemaDbResult | null>;
  deleteSchema(ws: string, id: string): Promise<SchemaDbResult | null>;

  listEnums(ws: string): Promise<WorkspaceEnumDbResult[]>;
  getEnum(ws: string, id: string): Promise<WorkspaceEnumDbResult | null>;
  createEnum(input: WorkspaceEnumDbCreate): Promise<WorkspaceEnumDbResult>;
  updateEnum(
    ws: string,
    id: string,
    input: WorkspaceEnumDbUpdate
  ): Promise<WorkspaceEnumDbResult | null>;
  deleteEnum(ws: string, id: string): Promise<WorkspaceEnumDbResult | null>;

  listEntities(ws: string, filters?: EntityListDbFilters): Promise<EntityDbResult[]>;
  getEntity(ws: string, identifier: string): Promise<EntityDbResult | null>;
  createEntity(input: EntityDbCreate): Promise<EntityDbResult>;
  updateEntity(ws: string, id: string, input: EntityDbUpdate): Promise<EntityDbResult | null>;
  deleteEntity(ws: string, id: string): Promise<Entity | null>;

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
      commit_message?: string | null;
    }
  ): Promise<EntitySnapshotDbResult | null>;
  applySnapshot(ws: string, snapshotId: string): Promise<EntitySnapshotDbResult | null>;
};

// -- Saved View

export type SavedViewDbResult = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  view_mode: BrowserView;
  filters: EntityFilters;
  config: {
    radar?: RadarViewConfig;
    timeline?: TimelineViewConfig;
    matrix?: MatrixViewConfig;
    hierarchy?: HierarchyViewConfig;
    explore?: ExploreViewConfig;
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

export type ViewDatabase = {
  listSavedViews(ws: string): Promise<SavedViewDbResult[]>;
  getSavedView(ws: string, id: string): Promise<SavedViewDbResult | null>;
  createSavedView(input: SavedViewDbCreate): Promise<SavedViewDbResult>;
  updateSavedView(
    ws: string,
    id: string,
    input: SavedViewDbUpdate
  ): Promise<SavedViewDbResult | null>;
  deleteSavedView(ws: string, id: string): Promise<SavedViewDbResult | null>;
};

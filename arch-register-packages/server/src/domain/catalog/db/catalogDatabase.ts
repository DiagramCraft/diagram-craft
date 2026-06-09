import { EntityLink, SchemaField, VisibilityMode } from '../../../types';
import { BrowserView, EntityFilters, RadarViewConfig } from '@arch-register/api-types/views';

// -- Entity Schema

export type EntitySchemaRow = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  fields: SchemaField[];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateEntitySchemaInput = EntitySchemaRow;

export type UpdateEntitySchemaInput = Omit<EntitySchemaRow, 'id' | 'workspace' | 'created_at'>;

// -- Workspace Enum

export type WorkspaceEnumRow = {
  id: string;
  workspace: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type CreateWorkspaceEnumInput = WorkspaceEnumRow;

export type UpdateWorkspaceEnumInput = Omit<WorkspaceEnumRow, 'id' | 'workspace' | 'created_at'>;

// -- Entity Grant

export type EntityGrantRow = {
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

export type CreateEntityGrantInput = EntityGrantRow;

// -- User Pinned Entity

export type UserPinnedEntityRow = {
  user_id: string;
  workspace: string;
  entity_id: string;
  created_at: Date;
};

export type CreateUserPinnedEntityInput = UserPinnedEntityRow;

// -- Entity

export type BaseEntity = {
  id: string;
  workspace: string;
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
export type EntityRow = BaseEntity & {
  owner_name: string | null;
  lifecycle_label: string | null;
  target_lifecycle_label: string | null;
  schema_name: string;
};

export type CreateEntityInput = BaseEntity;

export type UpdateEntityInput = Omit<BaseEntity, 'id' | 'workspace' | 'created_at'>;

export type CatalogDatabase = {
  resolveWorkspaceSlug(slug: string): Promise<string | null>;

  listSchemas(ws: string): Promise<EntitySchemaRow[]>;
  getSchema(ws: string, id: string): Promise<EntitySchemaRow | null>;
  createSchema(input: CreateEntitySchemaInput): Promise<EntitySchemaRow>;
  updateSchema(
    ws: string,
    id: string,
    input: UpdateEntitySchemaInput
  ): Promise<EntitySchemaRow | null>;
  deleteSchema(ws: string, id: string): Promise<EntitySchemaRow | null>;

  listEnums(ws: string): Promise<WorkspaceEnumRow[]>;
  getEnum(ws: string, id: string): Promise<WorkspaceEnumRow | null>;
  createEnum(input: CreateWorkspaceEnumInput): Promise<WorkspaceEnumRow>;
  updateEnum(
    ws: string,
    id: string,
    input: UpdateWorkspaceEnumInput
  ): Promise<WorkspaceEnumRow | null>;
  deleteEnum(ws: string, id: string): Promise<WorkspaceEnumRow | null>;

  listEntities(ws: string): Promise<EntityRow[]>;
  getEntity(ws: string, id: string): Promise<EntityRow | null>;
  createEntity(input: CreateEntityInput): Promise<EntityRow>;
  updateEntity(ws: string, id: string, input: UpdateEntityInput): Promise<EntityRow | null>;
  deleteEntity(ws: string, id: string): Promise<BaseEntity | null>;

  listEntityGrants(ws: string): Promise<EntityGrantRow[]>;
  getEntityGrants(ws: string, entityId: string): Promise<EntityGrantRow[]>;
  replaceEntityGrants(
    ws: string,
    entityId: string,
    grants: CreateEntityGrantInput[]
  ): Promise<EntityGrantRow[]>;

  listPinnedEntities(userId: string, workspace: string): Promise<UserPinnedEntityRow[]>;
  getPinnedEntity(
    userId: string,
    workspace: string,
    entityId: string
  ): Promise<UserPinnedEntityRow | null>;
  createPinnedEntity(input: CreateUserPinnedEntityInput): Promise<UserPinnedEntityRow>;
  deletePinnedEntity(
    userId: string,
    workspace: string,
    entityId: string
  ): Promise<UserPinnedEntityRow | null>;
};

// -- Saved View

export type SavedViewRow = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  view_mode: BrowserView;
  filters: EntityFilters;
  config: {
    radar?: RadarViewConfig;
  } | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateSavedViewInput = SavedViewRow;

export type UpdateSavedViewInput = Partial<
  Omit<SavedViewRow, 'id' | 'workspace' | 'created_at' | 'updated_at'>
> & {
  updated_at: Date;
};

export type ViewDatabase = {
  listSavedViews(ws: string): Promise<SavedViewRow[]>;
  getSavedView(ws: string, id: string): Promise<SavedViewRow | null>;
  createSavedView(input: CreateSavedViewInput): Promise<SavedViewRow>;
  updateSavedView(
    ws: string,
    id: string,
    input: UpdateSavedViewInput
  ): Promise<SavedViewRow | null>;
  deleteSavedView(ws: string, id: string): Promise<SavedViewRow | null>;
};

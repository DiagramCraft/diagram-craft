import type {
  Entity,
  EntityGrant,
  EntitySchema,
  SavedView,
  UserPinnedEntity,
  WorkspaceEnum
} from '../../../types';

export type CreateSchemaInput = Omit<EntitySchema, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateSchemaInput = {
  name: string;
  description: string;
  fields: EntitySchema['fields'];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  updated_at: Date;
};

export type CreateEnumInput = Omit<WorkspaceEnum, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateEnumInput = {
  name: string;
  options: Array<{ value: string; label: string }>;
  sort_order: number;
  updated_at: Date;
};

export type CreateEntityInput = Omit<Entity, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateEntityInput = Omit<Entity, 'id' | 'workspace' | 'created_at' | 'updated_at'> & {
  updated_at: Date;
};

export type CreateEntityGrantInput = Omit<EntityGrant, 'id'> & {
  id: string;
};

export type CreateSavedViewInput = Omit<SavedView, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateSavedViewInput = Partial<
  Omit<SavedView, 'id' | 'workspace' | 'created_at' | 'updated_at'>
> & {
  updated_at: Date;
};

export type CreateUserPinnedEntityInput = Omit<UserPinnedEntity, 'created_at'> & {
  created_at: Date;
};

export type CatalogDatabase = {
  resolveWorkspaceSlug(slug: string): Promise<string | null>;

  listSchemas(ws: string): Promise<EntitySchema[]>;
  getSchema(ws: string, id: string): Promise<EntitySchema | null>;
  createSchema(input: CreateSchemaInput): Promise<EntitySchema>;
  updateSchema(ws: string, id: string, input: UpdateSchemaInput): Promise<EntitySchema | null>;
  deleteSchema(ws: string, id: string): Promise<EntitySchema | null>;

  listEnums(ws: string): Promise<WorkspaceEnum[]>;
  getEnum(ws: string, id: string): Promise<WorkspaceEnum | null>;
  createEnum(input: CreateEnumInput): Promise<WorkspaceEnum>;
  updateEnum(ws: string, id: string, input: UpdateEnumInput): Promise<WorkspaceEnum | null>;
  deleteEnum(ws: string, id: string): Promise<WorkspaceEnum | null>;

  listEntities(ws: string): Promise<Entity[]>;
  getEntity(ws: string, id: string): Promise<Entity | null>;
  createEntity(input: CreateEntityInput): Promise<Entity>;
  updateEntity(ws: string, id: string, input: UpdateEntityInput): Promise<Entity | null>;
  deleteEntity(ws: string, id: string): Promise<Entity | null>;
  listEntityGrants(ws: string): Promise<EntityGrant[]>;
  getEntityGrants(ws: string, entityId: string): Promise<EntityGrant[]>;
  replaceEntityGrants(
    ws: string,
    entityId: string,
    grants: CreateEntityGrantInput[]
  ): Promise<EntityGrant[]>;

  listPinnedEntities(userId: string, workspace: string): Promise<UserPinnedEntity[]>;
  getPinnedEntity(
    userId: string,
    workspace: string,
    entityId: string
  ): Promise<UserPinnedEntity | null>;
  createPinnedEntity(input: CreateUserPinnedEntityInput): Promise<UserPinnedEntity>;
  deletePinnedEntity(
    userId: string,
    workspace: string,
    entityId: string
  ): Promise<UserPinnedEntity | null>;
};

export type ViewDatabase = {
  listSavedViews(ws: string): Promise<SavedView[]>;
  getSavedView(ws: string, id: string): Promise<SavedView | null>;
  createSavedView(input: CreateSavedViewInput): Promise<SavedView>;
  updateSavedView(ws: string, id: string, input: UpdateSavedViewInput): Promise<SavedView | null>;
  deleteSavedView(ws: string, id: string): Promise<SavedView | null>;
};
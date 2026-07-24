import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';

export type EntityExternalIdentityRow = {
  workspace: string;
  source: string;
  external_key: string;
  entity_id: string;
  created_at: Date;
  updated_at: Date;
};

export const entityExternalIdentityMappers = {
  identity: (row: DatabaseRow): EntityExternalIdentityRow => ({
    workspace: String(row['workspace']),
    source: String(row['source']),
    external_key: String(row['external_key']),
    entity_id: String(row['entity_id']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  })
};

export type EntityExternalIdentityDbCreate = {
  workspace: string;
  source: string;
  external_key: string;
  entity_id: string;
};

export type EntityExternalIdentityDatabase = {
  find(
    workspace: string,
    source: string,
    externalKey: string
  ): Promise<EntityExternalIdentityRow | null>;
  create(row: EntityExternalIdentityDbCreate): Promise<EntityExternalIdentityRow>;
};

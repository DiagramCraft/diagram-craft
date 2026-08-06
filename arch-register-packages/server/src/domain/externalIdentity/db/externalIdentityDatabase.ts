import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';

export type CatalogRecordExternalIdentityRow = {
  workspace: string;
  source: string;
  external_key: string;
  record_id: string;
  created_at: Date;
  updated_at: Date;
};

export const catalogRecordExternalIdentityMappers = {
  identity: (row: DatabaseRow): CatalogRecordExternalIdentityRow => ({
    workspace: String(row['workspace']),
    source: String(row['source']),
    external_key: String(row['external_key']),
    record_id: String(row['record_id']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  })
};

export type CatalogRecordExternalIdentityDbCreate = {
  workspace: string;
  source: string;
  external_key: string;
  record_id: string;
};

export type CatalogRecordExternalIdentityDatabase = {
  find(
    workspace: string,
    source: string,
    externalKey: string
  ): Promise<CatalogRecordExternalIdentityRow | null>;
  create(row: CatalogRecordExternalIdentityDbCreate): Promise<CatalogRecordExternalIdentityRow>;
};

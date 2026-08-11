import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

export type PublicCatalogConfigDbResult = {
  workspace: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: Date;
  updated_by: string | null;
};

export type PublicCatalogConfigDbUpsert = Omit<PublicCatalogConfigDbResult, 'updated_at'> & {
  updated_at: Date;
};

export const publicCatalogMappers = {
  config: (row: DatabaseRow): PublicCatalogConfigDbResult => ({
    workspace: String(row['workspace']),
    enabled: databaseBoolean(row['enabled']),
    config: parseDatabaseJson(row['config'], {}, 'workspace_public_catalog.config'),
    updated_at: databaseDate(row['updated_at']),
    updated_by: row['updated_by'] == null ? null : String(row['updated_by'])
  })
};

export type PublicCatalogDatabase = {
  getConfig(workspace: string): Promise<PublicCatalogConfigDbResult | null>;
  upsertConfig(input: PublicCatalogConfigDbUpsert): Promise<PublicCatalogConfigDbResult>;
};

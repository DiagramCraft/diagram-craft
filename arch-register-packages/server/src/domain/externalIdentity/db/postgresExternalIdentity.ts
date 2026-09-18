import type {
  CatalogRecordExternalIdentityDatabase,
  CatalogRecordExternalIdentityDbCreate
} from './externalIdentityDatabase';
import { catalogRecordExternalIdentityMappers } from './externalIdentityDatabase';
import { mapDatabaseRow, type DatabaseRow } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresExternalIdentityDatabase
  extends PostgresDatabaseBase
  implements CatalogRecordExternalIdentityDatabase
{
  async find(workspace: string, source: string, externalKey: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM catalog_record_external_identity
      WHERE workspace = ${workspace} AND source = ${source} AND external_key = ${externalKey}
    `;
    return mapDatabaseRow(rows[0], catalogRecordExternalIdentityMappers.identity);
  }

  async create(row: CatalogRecordExternalIdentityDbCreate) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        INSERT INTO catalog_record_external_identity (workspace, source, external_key, record_id)
        VALUES (${row.workspace}, ${row.source}, ${row.external_key}, ${row.record_id})
        RETURNING *
      `;
      return catalogRecordExternalIdentityMappers.identity(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async upsert(row: CatalogRecordExternalIdentityDbCreate) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        INSERT INTO catalog_record_external_identity (workspace, source, external_key, record_id)
        VALUES (${row.workspace}, ${row.source}, ${row.external_key}, ${row.record_id})
        ON CONFLICT (workspace, source, external_key) DO UPDATE SET
          record_id = EXCLUDED.record_id,
          updated_at = NOW()
        RETURNING *
      `;
      return catalogRecordExternalIdentityMappers.identity(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async delete(workspace: string, source: string, externalKey: string) {
    await this.sql`
      DELETE FROM catalog_record_external_identity
      WHERE workspace = ${workspace} AND source = ${source} AND external_key = ${externalKey}
    `;
  }
}

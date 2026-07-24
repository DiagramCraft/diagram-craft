import type {
  EntityExternalIdentityDatabase,
  EntityExternalIdentityDbCreate
} from './externalIdentityDatabase';
import { entityExternalIdentityMappers } from './externalIdentityDatabase';
import { mapDatabaseRow, type DatabaseRow } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresExternalIdentityDatabase
  extends PostgresDatabaseBase
  implements EntityExternalIdentityDatabase
{
  async find(workspace: string, source: string, externalKey: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_external_identity
      WHERE workspace = ${workspace} AND source = ${source} AND external_key = ${externalKey}
    `;
    return mapDatabaseRow(rows[0], entityExternalIdentityMappers.identity);
  }

  async create(row: EntityExternalIdentityDbCreate) {
    try {
      const rows = await this.sql<DatabaseRow[]>`
        INSERT INTO entity_external_identity (workspace, source, external_key, entity_id)
        VALUES (${row.workspace}, ${row.source}, ${row.external_key}, ${row.entity_id})
        RETURNING *
      `;
      return entityExternalIdentityMappers.identity(rows[0]!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}

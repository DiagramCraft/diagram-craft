import type {
  CatalogRecordExternalIdentityDatabase,
  CatalogRecordExternalIdentityDbCreate
} from './externalIdentityDatabase';
import { catalogRecordExternalIdentityMappers } from './externalIdentityDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteExternalIdentityDatabase
  extends SqliteDatabaseBase
  implements CatalogRecordExternalIdentityDatabase
{
  async find(workspace: string, source: string, externalKey: string) {
    return this.get(
      `SELECT * FROM catalog_record_external_identity WHERE workspace = ? AND source = ? AND external_key = ?`,
      [workspace, source, externalKey],
      catalogRecordExternalIdentityMappers.identity
    );
  }

  async create(row: CatalogRecordExternalIdentityDbCreate) {
    this.run(
      `INSERT INTO catalog_record_external_identity (workspace, source, external_key, record_id)
       VALUES (?, ?, ?, ?)`,
      [row.workspace, row.source, row.external_key, row.record_id]
    );
    const created = await this.find(row.workspace, row.source, row.external_key);
    return created!;
  }
}

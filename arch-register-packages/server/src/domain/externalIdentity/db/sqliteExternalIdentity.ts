import type {
  EntityExternalIdentityDatabase,
  EntityExternalIdentityDbCreate
} from './externalIdentityDatabase';
import { entityExternalIdentityMappers } from './externalIdentityDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteExternalIdentityDatabase
  extends SqliteDatabaseBase
  implements EntityExternalIdentityDatabase
{
  async find(workspace: string, source: string, externalKey: string) {
    return this.get(
      `SELECT * FROM entity_external_identity WHERE workspace = ? AND source = ? AND external_key = ?`,
      [workspace, source, externalKey],
      entityExternalIdentityMappers.identity
    );
  }

  async create(row: EntityExternalIdentityDbCreate) {
    this.run(
      `INSERT INTO entity_external_identity (workspace, source, external_key, entity_id)
       VALUES (?, ?, ?, ?)`,
      [row.workspace, row.source, row.external_key, row.entity_id]
    );
    const created = await this.find(row.workspace, row.source, row.external_key);
    return created!;
  }
}

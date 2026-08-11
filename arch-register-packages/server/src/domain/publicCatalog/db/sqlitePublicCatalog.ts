import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type { PublicCatalogConfigDbUpsert, PublicCatalogDatabase } from './publicCatalogDatabase';
import { publicCatalogMappers } from './publicCatalogDatabase';

export class SqlitePublicCatalogDatabase
  extends SqliteDatabaseBase
  implements PublicCatalogDatabase
{
  async getConfig(workspace: string) {
    return this.get(
      'SELECT * FROM workspace_public_catalog WHERE workspace = ?',
      [workspace],
      publicCatalogMappers.config
    );
  }

  async upsertConfig(input: PublicCatalogConfigDbUpsert) {
    this.run(
      `INSERT INTO workspace_public_catalog (workspace, enabled, config, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(workspace) DO UPDATE SET
         enabled = excluded.enabled,
         config = excluded.config,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
      [
        input.workspace,
        input.enabled ? 1 : 0,
        JSON.stringify(input.config),
        input.updated_at.toISOString(),
        input.updated_by
      ]
    );
    return (await this.getConfig(input.workspace))!;
  }
}

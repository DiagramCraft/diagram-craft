import type { DatabaseRow } from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type { PublicCatalogConfigDbUpsert, PublicCatalogDatabase } from './publicCatalogDatabase';
import { publicCatalogMappers } from './publicCatalogDatabase';

export class PostgresPublicCatalogDatabase
  extends PostgresDatabaseBase
  implements PublicCatalogDatabase
{
  async getConfig(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_public_catalog WHERE workspace = ${workspace}
    `;
    return rows.length === 0 ? null : publicCatalogMappers.config(rows[0]!);
  }

  async upsertConfig(input: PublicCatalogConfigDbUpsert) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO workspace_public_catalog
          (workspace, enabled, config, updated_at, updated_by)
        VALUES
          (${input.workspace}, ${input.enabled}, ${this.json(input.config)}, ${input.updated_at}, ${input.updated_by})
        ON CONFLICT (workspace) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          config = EXCLUDED.config,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by
        RETURNING *
      `;
      return publicCatalogMappers.config(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}

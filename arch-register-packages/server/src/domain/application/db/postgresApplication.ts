import type {
  ApplicationDatabase,
  ApplicationDbCreate,
  ApplicationDbUpdate
} from './applicationDatabase';
import { mapWorkspaceApplicationRow } from './applicationDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresApplicationDatabase
  extends PostgresDatabaseBase
  implements ApplicationDatabase
{
  async list(workspace: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM workspace_application WHERE workspace = ${workspace} ORDER BY sort_order
    `;
    return rows.map(mapWorkspaceApplicationRow);
  }

  async get(workspace: string, id: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM workspace_application WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? mapWorkspaceApplicationRow(row) : null;
  }

  async getByKey(workspace: string, key: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM workspace_application WHERE workspace = ${workspace} AND key = ${key}
    `;
    return row ? mapWorkspaceApplicationRow(row) : null;
  }

  async create(input: ApplicationDbCreate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        INSERT INTO workspace_application (id, workspace, key, name, description, accent_color, sort_order, created_at, updated_at, updated_by)
        VALUES (${input.id}, ${input.workspace}, ${input.key}, ${input.name}, ${input.description ?? ''}, ${input.accent_color ?? null}, ${input.sort_order}, NOW(), NOW(), ${input.updated_by})
        RETURNING *
      `;
      return mapWorkspaceApplicationRow(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async update(workspace: string, id: string, input: ApplicationDbUpdate) {
    const touchesAccent = 'accent_color' in input;
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        UPDATE workspace_application
        SET name = COALESCE(${input.name ?? null}, name),
            description = COALESCE(${input.description ?? null}, description),
            accent_color = ${touchesAccent ? (input.accent_color ?? null) : this.sql`accent_color`},
            sort_order = COALESCE(${input.sort_order ?? null}, sort_order),
            updated_at = NOW(),
            updated_by = ${input.updated_by}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? mapWorkspaceApplicationRow(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async remove(workspace: string, id: string) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        DELETE FROM workspace_application
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? mapWorkspaceApplicationRow(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}

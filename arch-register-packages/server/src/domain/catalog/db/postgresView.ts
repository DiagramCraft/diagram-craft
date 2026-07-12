import type {
  SavedViewDbCreate,
  SavedViewDbUpdate,
  ViewDatabase
} from './catalogDatabase';
import { catalogMappers } from './catalogDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresViewDatabase extends PostgresDatabaseBase implements ViewDatabase {
  async listSavedViews(
    workspace: string,
    options?: {
      projectId?: string | null;
      includeWorkspace?: boolean;
    }
  ) {
    const projectId = options?.projectId ?? null;
    const includeWorkspace = options?.includeWorkspace ?? false;

    if (projectId == null) {
      const rows = await this.sql<Record<string, unknown>[]>`
        SELECT * FROM saved_view
        WHERE workspace = ${workspace} AND project_id IS NULL
        ORDER BY name
      `;
      return rows.map(catalogMappers.savedView);
    }

    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM saved_view
      WHERE workspace = ${workspace}
        AND (
          project_id = ${projectId}
          OR (${includeWorkspace} = true AND project_id IS NULL)
        )
      ORDER BY CASE WHEN project_id IS NULL THEN 1 ELSE 0 END, name
    `;
    return rows.map(catalogMappers.savedView);
  }

  async getSavedView(workspace: string, id: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM saved_view WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? catalogMappers.savedView(row) : null;
  }

  async createSavedView(input: SavedViewDbCreate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        INSERT INTO saved_view (id, workspace, project_id, project_scope, name, description, is_admin_view, view_mode, filters, config, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.project_id}, ${input.project_scope}, ${input.name}, ${input.description}, ${input.is_admin_view}, ${input.view_mode}, ${this.json(input.filters)}, ${this.json(input.config)}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return catalogMappers.savedView(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateSavedView(workspace: string, id: string, input: SavedViewDbUpdate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        UPDATE saved_view
        SET name = COALESCE(${input.name ?? null}, name),
            description = COALESCE(${input.description ?? null}, description),
            is_admin_view = COALESCE(${input.is_admin_view ?? null}, is_admin_view),
            view_mode = COALESCE(${input.view_mode ?? null}, view_mode),
            filters = COALESCE(${input.filters ? this.json(input.filters) : null}, filters),
            config = COALESCE(${input.config === undefined ? null : this.json(input.config)}, config),
            project_scope = COALESCE(${input.project_scope ?? null}, project_scope),
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? catalogMappers.savedView(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteSavedView(workspace: string, id: string) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        DELETE FROM saved_view
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? catalogMappers.savedView(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}

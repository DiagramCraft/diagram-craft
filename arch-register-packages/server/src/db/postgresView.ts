import type { CreateSavedViewInput, UpdateSavedViewInput, ViewDatabase } from './database';
import {
  normalizePostgresError,
  PostgresDatabaseBase,
  type PostgresRowTypes
} from './postgresBase';

export class PostgresViewDatabase extends PostgresDatabaseBase implements ViewDatabase {
  async listSavedViews(workspace: string) {
    return await this.sql<PostgresRowTypes['savedView'][]>`
      SELECT * FROM saved_view WHERE workspace = ${workspace} ORDER BY name
    `;
  }

  async getSavedView(workspace: string, id: string) {
    const [row] = await this.sql<PostgresRowTypes['savedView'][]>`
      SELECT * FROM saved_view WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createSavedView(input: CreateSavedViewInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['savedView'][]>`
        INSERT INTO saved_view (id, workspace, name, description, view_mode, filters, config, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.view_mode}, ${this.json(input.filters)}, ${this.json(input.config)}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateSavedView(workspace: string, id: string, input: UpdateSavedViewInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['savedView'][]>`
        UPDATE saved_view
        SET name = COALESCE(${input.name ?? null}, name),
            description = COALESCE(${input.description ?? null}, description),
            view_mode = COALESCE(${input.view_mode ?? null}, view_mode),
            filters = COALESCE(${input.filters ? this.json(input.filters) : null}, filters),
            config = COALESCE(${input.config ? this.json(input.config) : null}, config),
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteSavedView(workspace: string, id: string) {
    try {
      const [row] = await this.sql<PostgresRowTypes['savedView'][]>`
        DELETE FROM saved_view
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}

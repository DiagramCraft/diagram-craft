import type {
  CollectionDbCreate,
  CollectionDbUpdate,
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

  async listCollections(userId: string, workspace: string, entityId?: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT c.*,
             COUNT(ce.entity_id)::int AS entity_count,
             CASE WHEN ${entityId ?? null}::uuid IS NOT NULL AND EXISTS (
               SELECT 1 FROM user_collection_entity member
               WHERE member.collection_id = c.id AND member.entity_id = ${entityId ?? null}::uuid
             ) THEN true ELSE false END AS is_member
      FROM user_collection c
      LEFT JOIN user_collection_entity ce ON ce.collection_id = c.id
      WHERE c.user_id = ${userId} AND c.workspace = ${workspace}
      GROUP BY c.id
      ORDER BY c.name, c.created_at
    `;
    return rows.map(catalogMappers.collection);
  }

  async getCollection(userId: string, workspace: string, id: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT c.*, COUNT(ce.entity_id)::int AS entity_count
      FROM user_collection c
      LEFT JOIN user_collection_entity ce ON ce.collection_id = c.id
      WHERE c.id = ${id} AND c.user_id = ${userId} AND c.workspace = ${workspace}
      GROUP BY c.id
    `;
    return row ? catalogMappers.collection(row) : null;
  }

  async createCollection(input: CollectionDbCreate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        INSERT INTO user_collection (id, user_id, workspace, name, created_at, updated_at)
        VALUES (${input.id}, ${input.user_id}, ${input.workspace}, ${input.name}, ${input.created_at}, ${input.updated_at})
        RETURNING *, 0::int AS entity_count
      `;
      return catalogMappers.collection(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateCollection(userId: string, workspace: string, id: string, input: CollectionDbUpdate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        UPDATE user_collection
        SET name = ${input.name}, updated_at = ${input.updated_at}
        WHERE id = ${id} AND user_id = ${userId} AND workspace = ${workspace}
        RETURNING *, 0::int AS entity_count
      `;
      if (!row) return null;
      return await this.getCollection(userId, workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteCollection(userId: string, workspace: string, id: string) {
    const existing = await this.getCollection(userId, workspace, id);
    if (!existing) return null;
    try {
      await this.sql`
        DELETE FROM user_collection
        WHERE id = ${id} AND user_id = ${userId} AND workspace = ${workspace}
      `;
      return existing;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async addCollectionEntity(
    userId: string,
    workspace: string,
    collectionId: string,
    entityId: string,
    createdAt: Date
  ) {
    const collection = await this.getCollection(userId, workspace, collectionId);
    if (!collection) return null!;
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        INSERT INTO user_collection_entity (collection_id, entity_id, created_at)
        VALUES (${collectionId}, ${entityId}, ${createdAt})
        ON CONFLICT (collection_id, entity_id) DO UPDATE SET created_at = user_collection_entity.created_at
        RETURNING *
      `;
      return catalogMappers.collectionEntity(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async removeCollectionEntity(userId: string, workspace: string, collectionId: string, entityId: string) {
    const collection = await this.getCollection(userId, workspace, collectionId);
    if (!collection) return null;
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        DELETE FROM user_collection_entity
        WHERE collection_id = ${collectionId} AND entity_id = ${entityId}
        RETURNING *
      `;
      return row ? catalogMappers.collectionEntity(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listCollectionEntityIds(userId: string, workspace: string, collectionId: string) {
    const collection = await this.getCollection(userId, workspace, collectionId);
    if (!collection) return [];
    const rows = await this.sql<{ entity_id: string }[]>`
      SELECT entity_id
      FROM user_collection_entity
      WHERE collection_id = ${collectionId}
      ORDER BY created_at, entity_id
    `;
    return rows.map(row => row.entity_id);
  }
}

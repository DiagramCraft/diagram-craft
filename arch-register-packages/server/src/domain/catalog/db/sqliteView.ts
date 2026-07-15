import type {
  CollectionDbCreate,
  CollectionDbUpdate,
  SavedViewDbCreate,
  SavedViewDbUpdate,
  ViewDatabase
} from './catalogDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import { catalogMappers } from './catalogDatabase';

export class SqliteViewDatabase extends SqliteDatabaseBase implements ViewDatabase {
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
      return this.all(
        'SELECT * FROM saved_view WHERE workspace = ? AND project_id IS NULL ORDER BY name',
        [workspace],
        catalogMappers.savedView
      );
    }

    return this.all(
      `SELECT * FROM saved_view
       WHERE workspace = ?
         AND (
           project_id = ?
           OR (? = 1 AND project_id IS NULL)
         )
       ORDER BY CASE WHEN project_id IS NULL THEN 1 ELSE 0 END, name`,
      [workspace, projectId, includeWorkspace ? 1 : 0],
      catalogMappers.savedView
    );
  }

  async getSavedView(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM saved_view WHERE workspace = ? AND id = ?',
      [workspace, id],
      catalogMappers.savedView
    );
  }

  async createSavedView(input: SavedViewDbCreate) {
    this.run(
      'INSERT INTO saved_view (id, workspace, project_id, project_scope, name, description, is_admin_view, view_mode, filters, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.project_id,
        input.project_scope,
        input.name,
        input.description,
        input.is_admin_view ? 1 : 0,
        input.view_mode,
        JSON.stringify(input.filters),
        input.config ? JSON.stringify(input.config) : null,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getSavedView(input.workspace, input.id))!;
  }

  async updateSavedView(workspace: string, id: string, input: SavedViewDbUpdate) {
    const existing = await this.getSavedView(workspace, id);
    if (!existing) return null;

    this.run(
      `UPDATE saved_view
       SET name = ?,
           description = ?,
           is_admin_view = ?,
           view_mode = ?,
           filters = ?,
           config = ?,
           project_scope = ?,
           updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.name ?? existing.name,
        input.description === undefined ? existing.description : input.description,
        (input.is_admin_view === undefined ? existing.is_admin_view : input.is_admin_view) ? 1 : 0,
        input.view_mode ?? existing.view_mode,
        input.filters ? JSON.stringify(input.filters) : JSON.stringify(existing.filters),
        input.config === undefined ? JSON.stringify(existing.config) : JSON.stringify(input.config),
        input.project_scope === undefined ? existing.project_scope : input.project_scope,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getSavedView(workspace, id);
  }

  async deleteSavedView(workspace: string, id: string) {
    const existing = await this.getSavedView(workspace, id);
    if (!existing) return null;

    this.run('DELETE FROM saved_view WHERE workspace = ? AND id = ?', [workspace, id]);
    return existing;
  }

  async listCollections(userId: string, workspace: string, entityId?: string) {
    return this.all(
      `SELECT c.*,
              COUNT(ce.entity_id) AS entity_count,
              CASE WHEN ? IS NOT NULL AND EXISTS (
                SELECT 1 FROM user_collection_entity member
                WHERE member.collection_id = c.id AND member.entity_id = ?
              ) THEN 1 ELSE 0 END AS is_member
       FROM user_collection c
       LEFT JOIN user_collection_entity ce ON ce.collection_id = c.id
       WHERE c.user_id = ? AND c.workspace = ?
       GROUP BY c.id
       ORDER BY c.name, c.created_at`,
      [entityId ?? null, entityId ?? null, userId, workspace],
      catalogMappers.collection
    );
  }

  async getCollection(userId: string, workspace: string, id: string) {
    return this.get(
      `SELECT c.*, COUNT(ce.entity_id) AS entity_count
       FROM user_collection c
       LEFT JOIN user_collection_entity ce ON ce.collection_id = c.id
       WHERE c.id = ? AND c.user_id = ? AND c.workspace = ?
       GROUP BY c.id`,
      [id, userId, workspace],
      catalogMappers.collection
    );
  }

  async createCollection(input: CollectionDbCreate) {
    this.run(
      'INSERT INTO user_collection (id, user_id, workspace, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.user_id,
        input.workspace,
        input.name,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getCollection(input.user_id, input.workspace, input.id))!;
  }

  async updateCollection(userId: string, workspace: string, id: string, input: CollectionDbUpdate) {
    const existing = await this.getCollection(userId, workspace, id);
    if (!existing) return null;
    this.run(
      'UPDATE user_collection SET name = ?, updated_at = ? WHERE id = ? AND user_id = ? AND workspace = ?',
      [input.name, input.updated_at.toISOString(), id, userId, workspace]
    );
    return await this.getCollection(userId, workspace, id);
  }

  async deleteCollection(userId: string, workspace: string, id: string) {
    const existing = await this.getCollection(userId, workspace, id);
    if (!existing) return null;
    this.run('DELETE FROM user_collection WHERE id = ? AND user_id = ? AND workspace = ?', [
      id,
      userId,
      workspace
    ]);
    return existing;
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
    this.run(
      'INSERT OR IGNORE INTO user_collection_entity (collection_id, entity_id, created_at) VALUES (?, ?, ?)',
      [collectionId, entityId, createdAt.toISOString()]
    );
    return (await this.getCollectionEntity(collectionId, entityId))!;
  }

  async removeCollectionEntity(
    userId: string,
    workspace: string,
    collectionId: string,
    entityId: string
  ) {
    const collection = await this.getCollection(userId, workspace, collectionId);
    if (!collection) return null;
    const existing = await this.getCollectionEntity(collectionId, entityId);
    if (!existing) return null;
    this.run('DELETE FROM user_collection_entity WHERE collection_id = ? AND entity_id = ?', [
      collectionId,
      entityId
    ]);
    return existing;
  }

  async listCollectionEntityIds(userId: string, workspace: string, collectionId: string) {
    const collection = await this.getCollection(userId, workspace, collectionId);
    if (!collection) return [];
    return this.all<{ entity_id: string }>(
      'SELECT entity_id FROM user_collection_entity WHERE collection_id = ? ORDER BY created_at, entity_id',
      [collectionId]
    ).map(row => row.entity_id);
  }

  private async getCollectionEntity(collectionId: string, entityId: string) {
    return this.get(
      'SELECT * FROM user_collection_entity WHERE collection_id = ? AND entity_id = ?',
      [collectionId, entityId],
      catalogMappers.collectionEntity
    );
  }
}

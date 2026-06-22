import type {
  CatalogDatabase,
  EntityGrantDbCretae,
  EntityDbCreate,
  WorkspaceEnumDbCreate,
  SchemaDbCreate,
  EntityDbUpdate,
  WorkspaceEnumDbUpdate,
  SchemaDbUpdate,
  PinnedEntityDbCreate,
  EntitySnapshotDbCreate
} from './catalogDatabase';
import { SqliteDatabaseBase, sqliteMappers } from '../../../db/sqliteBase';
import { isUuidLike } from '../../../utils/publicIds';

const ENTITY_JOIN_SQL = `
  SELECT e.*,
    wo.name   AS owner_name,
    ls.label  AS lifecycle_label,
    tls.label AS target_lifecycle_label,
    es.name   AS schema_name
  FROM entity e
  LEFT JOIN workspace_owner wo            ON wo.id  = e.owner
  LEFT JOIN workspace_lifecycle_state ls  ON ls.id  = e.lifecycle
  LEFT JOIN workspace_lifecycle_state tls ON tls.id = e.target_lifecycle
  JOIN entity_schema es ON es.id = e.schema_id
  WHERE e.deleted_at IS NULL
`;

export class SqliteCatalogDatabase extends SqliteDatabaseBase implements CatalogDatabase {
  async resolveWorkspaceSlug(slug: string) {
    const row = this.get<{ id: string }>('SELECT id FROM workspace WHERE url_slug = ?', [slug]);
    return row?.id ?? null;
  }

  async listSchemas(workspace: string) {
    return this.all(
      'SELECT * FROM entity_schema WHERE workspace = ? ORDER BY name',
      [workspace],
      sqliteMappers.schema
    );
  }

  async getSchema(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM entity_schema WHERE workspace = ? AND id = ?',
      [workspace, id],
      sqliteMappers.schema
    );
  }

  async getSchemaByKeyPrefix(prefix: string) {
    return this.get(
      'SELECT * FROM entity_schema WHERE key_prefix = ?',
      [prefix],
      sqliteMappers.schema
    );
  }

  async createSchema(input: SchemaDbCreate) {
    this.run(
      'INSERT INTO entity_schema (id, workspace, name, description, fields, color, icon, default_owner, key_prefix, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        JSON.stringify(input.fields),
        input.color,
        input.icon,
        input.default_owner,
        input.key_prefix,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getSchema(input.workspace, input.id))!;
  }

  async updateSchema(workspace: string, id: string, input: SchemaDbUpdate) {
    this.run(
      'UPDATE entity_schema SET name = ?, description = ?, fields = ?, color = ?, icon = ?, default_owner = ?, key_prefix = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        input.description,
        JSON.stringify(input.fields),
        input.color,
        input.icon,
        input.default_owner,
        input.key_prefix,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getSchema(workspace, id);
  }

  async deleteSchema(workspace: string, id: string) {
    const row = await this.getSchema(workspace, id);
    if (!row) return null;
    this.run('DELETE FROM entity_schema WHERE workspace = ? AND id = ?', [workspace, id]);
    return row;
  }

  async listEnums(workspace: string) {
    return this.all(
      'SELECT * FROM workspace_enum WHERE workspace = ? ORDER BY sort_order, name',
      [workspace],
      sqliteMappers.workspaceEnum
    );
  }

  async getEnum(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM workspace_enum WHERE workspace = ? AND id = ?',
      [workspace, id],
      sqliteMappers.workspaceEnum
    );
  }

  async createEnum(input: WorkspaceEnumDbCreate) {
    this.run(
      'INSERT INTO workspace_enum (id, workspace, name, options, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        JSON.stringify(input.options),
        input.sort_order,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getEnum(input.workspace, input.id))!;
  }

  async updateEnum(workspace: string, id: string, input: WorkspaceEnumDbUpdate) {
    this.run(
      'UPDATE workspace_enum SET name = ?, options = ?, sort_order = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        JSON.stringify(input.options),
        input.sort_order,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getEnum(workspace, id);
  }

  async deleteEnum(workspace: string, id: string) {
    const row = await this.getEnum(workspace, id);
    if (!row) return null;
    this.run('DELETE FROM workspace_enum WHERE workspace = ? AND id = ?', [workspace, id]);
    return row;
  }

  async listEntities(workspace: string) {
    return this.all(
      `${ENTITY_JOIN_SQL} AND e.workspace = ? ORDER BY e.name`,
      [workspace],
      sqliteMappers.enrichedEntity
    );
  }

  async getEntity(workspace: string, identifier: string) {
    if (!isUuidLike(identifier)) {
      return this.getEntityByPublicId(workspace, identifier);
    }
    return this.get(
      `${ENTITY_JOIN_SQL} AND e.workspace = ? AND e.id = ?`,
      [workspace, identifier],
      sqliteMappers.enrichedEntity
    );
  }

  private async getEntityByPublicId(workspace: string, publicId: string) {
    return this.get(
      `${ENTITY_JOIN_SQL} AND e.public_id = ? AND e.workspace = ?`,
      [publicId, workspace],
      sqliteMappers.enrichedEntity
    );
  }

  async createEntity(input: EntityDbCreate) {
    this.run(
      'INSERT INTO entity (id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, visibility_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.public_id,
        input.slug,
        input.namespace,
        input.name,
        input.description,
        input.owner,
        input.lifecycle,
        input.target_lifecycle,
        input.target_lifecycle_date,
        JSON.stringify(input.tags),
        JSON.stringify(input.links),
        input.schema_id,
        JSON.stringify(input.data),
        input.visibility_mode,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getEntity(input.workspace, input.id))!;
  }

  async updateEntity(workspace: string, id: string, input: EntityDbUpdate) {
    this.run(
      'UPDATE entity SET slug = ?, namespace = ?, name = ?, description = ?, owner = ?, lifecycle = ?, target_lifecycle = ?, target_lifecycle_date = ?, tags = ?, links = ?, schema_id = ?, data = ?, visibility_mode = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.slug,
        input.namespace,
        input.name,
        input.description,
        input.owner,
        input.lifecycle,
        input.target_lifecycle,
        input.target_lifecycle_date,
        JSON.stringify(input.tags),
        JSON.stringify(input.links),
        input.schema_id,
        JSON.stringify(input.data),
        input.visibility_mode,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getEntity(workspace, id);
  }

  async deleteEntity(workspace: string, id: string) {
    const row = await this.getEntity(workspace, id);
    if (!row) return null;
    this.run(
      'UPDATE entity SET deleted_at = ?, owner = NULL, lifecycle = NULL, target_lifecycle = NULL WHERE workspace = ? AND id = ?',
      [new Date().toISOString(), workspace, id]
    );
    return row;
  }

  async listEntityGrants(workspace: string) {
    return this.all(
      'SELECT * FROM entity_grant WHERE workspace = ? ORDER BY entity_id, principal_type, principal_id',
      [workspace],
      sqliteMappers.entityGrant
    );
  }

  async getEntityGrants(workspace: string, entityId: string) {
    return this.all(
      'SELECT * FROM entity_grant WHERE workspace = ? AND entity_id = ? ORDER BY principal_type, principal_id',
      [workspace, entityId],
      sqliteMappers.entityGrant
    );
  }

  async replaceEntityGrants(workspace: string, entityId: string, grants: EntityGrantDbCretae[]) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM entity_grant WHERE workspace = ? AND entity_id = ?', [
        workspace,
        entityId
      ]);
      for (const grant of grants) {
        this.run(
          'INSERT INTO entity_grant (id, workspace, entity_id, principal_type, principal_id, role, applies_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            grant.id,
            workspace,
            entityId,
            grant.principal_type,
            grant.principal_id,
            grant.role,
            grant.applies_to,
            grant.created_at.toISOString()
          ]
        );
      }
    });

    tx();
    return await this.getEntityGrants(workspace, entityId);
  }

  async listPinnedEntities(userId: string, workspace: string) {
    return this.all(
      'SELECT * FROM user_pinned_entity WHERE user_id = ? AND workspace = ? ORDER BY created_at DESC',
      [userId, workspace],
      sqliteMappers.userPinnedEntity
    );
  }

  async getPinnedEntity(userId: string, workspace: string, entityId: string) {
    return await this.get(
      'SELECT * FROM user_pinned_entity WHERE user_id = ? AND workspace = ? AND entity_id = ?',
      [userId, workspace, entityId],
      sqliteMappers.userPinnedEntity
    );
  }

  async createPinnedEntity(input: PinnedEntityDbCreate) {
    this.run(
      'INSERT OR IGNORE INTO user_pinned_entity (user_id, workspace, entity_id, created_at) VALUES (?, ?, ?, ?)',
      [input.user_id, input.workspace, input.entity_id, input.created_at.toISOString()]
    );
    return (await this.get(
      'SELECT * FROM user_pinned_entity WHERE user_id = ? AND workspace = ? AND entity_id = ?',
      [input.user_id, input.workspace, input.entity_id],
      sqliteMappers.userPinnedEntity
    ))!;
  }

  async deletePinnedEntity(userId: string, workspace: string, entityId: string) {
    const existing = await this.getPinnedEntity(userId, workspace, entityId);
    if (!existing) return null;
    this.run(
      'DELETE FROM user_pinned_entity WHERE user_id = ? AND workspace = ? AND entity_id = ?',
      [userId, workspace, entityId]
    );
    return existing;
  }

  async createSnapshot(input: EntitySnapshotDbCreate) {
    this.run(
      'INSERT INTO entity_snapshot (id, workspace, entity_id, status, project_id, target_date, commit_message, created_at, created_by, created_by_name, base_state, proposed_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.entity_id,
        input.status,
        input.project_id,
        input.target_date,
        input.commit_message,
        input.created_at.toISOString(),
        input.created_by,
        input.created_by_name,
        JSON.stringify(input.base_state),
        input.proposed_state != null ? JSON.stringify(input.proposed_state) : null
      ]
    );
    return (await this.get(
      `SELECT s.*, u.display_name as created_by_name
       FROM entity_snapshot s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.id = ?`,
      [input.id],
      sqliteMappers.entitySnapshot
    ))!;
  }


  async getSnapshot(workspace: string, snapshotId: string) {
    return await this.get(
      `SELECT s.*, u.display_name as created_by_name
       FROM entity_snapshot s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.workspace = ? AND s.id = ?`,
      [workspace, snapshotId],
      sqliteMappers.entitySnapshot
    );
  }

  async listSnapshots(workspace: string, entityId: string) {
    return this.all(
      `SELECT s.*, u.display_name as created_by_name
       FROM entity_snapshot s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.workspace = ? AND s.entity_id = ?
       ORDER BY s.created_at DESC`,
      [workspace, entityId],
      sqliteMappers.entitySnapshot
    );
  }

  async listSnapshotsByProject(workspace: string, projectId: string) {
    return this.all(
      `SELECT s.*, u.display_name as created_by_name
       FROM entity_snapshot s
       INNER JOIN project p ON p.id = s.project_id
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.workspace = ?
         AND p.workspace = ?
         AND (p.id = ? OR p.public_id = ?)
         AND s.status IN ('future_update', 'applied')
       ORDER BY CASE WHEN s.target_date IS NULL THEN 1 ELSE 0 END, s.target_date ASC, s.created_at DESC`,
      [workspace, workspace, projectId, projectId],
      sqliteMappers.entitySnapshot
    );
  }

  async pruneAutosaveSnapshots(workspace: string, entityId: string, keepCount: number) {
    this.run(
      `DELETE FROM entity_snapshot
       WHERE workspace = ? AND entity_id = ? AND status = 'autosave'
         AND id NOT IN (
           SELECT id FROM entity_snapshot
           WHERE workspace = ? AND entity_id = ? AND status = 'autosave'
           ORDER BY created_at DESC
           LIMIT ?
         )`,
      [workspace, entityId, workspace, entityId, keepCount]
    );
  }

  async promoteSnapshot(workspace: string, snapshotId: string, commitMessage: string | null) {
    const existing = await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ? AND workspace = ?',
      [snapshotId, workspace],
      sqliteMappers.entitySnapshot
    );
    if (!existing || existing.status !== 'autosave') return null;

    this.run(
      `UPDATE entity_snapshot SET status = 'saved_version', commit_message = ? WHERE id = ?`,
      [commitMessage, snapshotId]
    );
    return await this.get(
      `SELECT s.*, u.display_name as created_by_name
       FROM entity_snapshot s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.id = ?`,
      [snapshotId],
      sqliteMappers.entitySnapshot
    );
  }

  async updateSnapshot(
    workspace: string,
    snapshotId: string,
    updates: {
      proposed_state?: Record<string, unknown>;
      target_date?: string | null;
      commit_message?: string | null;
    }
  ) {
    const existing = await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ? AND workspace = ?',
      [snapshotId, workspace],
      sqliteMappers.entitySnapshot
    );
    if (!existing || existing.status !== 'future_update') return null;

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.proposed_state !== undefined) {
      setClauses.push('proposed_state = ?');
      params.push(JSON.stringify(updates.proposed_state));
    }
    if (updates.target_date !== undefined) {
      setClauses.push('target_date = ?');
      params.push(updates.target_date);
    }
    if (updates.commit_message !== undefined) {
      setClauses.push('commit_message = ?');
      params.push(updates.commit_message);
    }

    if (setClauses.length === 0) return existing;

    params.push(snapshotId);
    this.run(
      `UPDATE entity_snapshot SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
    return await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ?',
      [snapshotId],
      sqliteMappers.entitySnapshot
    );
  }

  async applySnapshot(workspace: string, snapshotId: string) {
    const existing = await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ? AND workspace = ?',
      [snapshotId, workspace],
      sqliteMappers.entitySnapshot
    );
    if (!existing || existing.status !== 'future_update') return null;

    this.run(
      `UPDATE entity_snapshot SET status = 'applied' WHERE id = ?`,
      [snapshotId]
    );
    return await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ?',
      [snapshotId],
      sqliteMappers.entitySnapshot
    );
  }
}

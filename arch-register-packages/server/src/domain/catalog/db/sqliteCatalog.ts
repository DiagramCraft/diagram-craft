import type {
  CatalogDatabase,
  EntityGrantDbCretae,
  EntityDbCreate,
  WorkspaceEnumDbCreate,
  SchemaDbCreate,
  EntityDbUpdate,
  WorkspaceEnumDbUpdate,
  SchemaDbUpdate,
  PinnedEntityDbCreate
} from './catalogDatabase';
import { SqliteDatabaseBase, sqliteMappers } from '../../../db/sqliteBase';

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

  async createSchema(input: SchemaDbCreate) {
    this.run(
      'INSERT INTO entity_schema (id, workspace, name, description, fields, color, icon, default_owner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        JSON.stringify(input.fields),
        input.color,
        input.icon,
        input.default_owner,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getSchema(input.workspace, input.id))!;
  }

  async updateSchema(workspace: string, id: string, input: SchemaDbUpdate) {
    this.run(
      'UPDATE entity_schema SET name = ?, description = ?, fields = ?, color = ?, icon = ?, default_owner = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        input.description,
        JSON.stringify(input.fields),
        input.color,
        input.icon,
        input.default_owner,
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
      `${ENTITY_JOIN_SQL} WHERE e.workspace = ? ORDER BY e.name`,
      [workspace],
      sqliteMappers.enrichedEntity
    );
  }

  async getEntity(workspace: string, id: string) {
    return this.get(
      `${ENTITY_JOIN_SQL} WHERE e.workspace = ? AND e.id = ?`,
      [workspace, id],
      sqliteMappers.enrichedEntity
    );
  }

  async createEntity(input: EntityDbCreate) {
    this.run(
      'INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, visibility_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
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
    this.run('DELETE FROM entity WHERE workspace = ? AND id = ?', [workspace, id]);
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
}

import type {
  CatalogDatabase,
  CreateEnumInput,
  CreateEntityGrantInput,
  CreateEntityInput,
  CreateSchemaInput,
  CreateSavedViewInput,
  UpdateEnumInput,
  UpdateEntityInput,
  UpdateSchemaInput,
  UpdateSavedViewInput
} from './database';
import { SqliteDatabaseBase, sqliteMappers } from './sqliteBase';

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

  async createSchema(input: CreateSchemaInput) {
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

  async updateSchema(workspace: string, id: string, input: UpdateSchemaInput) {
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

  async createEnum(input: CreateEnumInput) {
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

  async updateEnum(workspace: string, id: string, input: UpdateEnumInput) {
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
      'SELECT * FROM entity WHERE workspace = ? ORDER BY name',
      [workspace],
      sqliteMappers.entity
    );
  }

  async getEntity(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM entity WHERE workspace = ? AND id = ?',
      [workspace, id],
      sqliteMappers.entity
    );
  }

  async createEntity(input: CreateEntityInput) {
    this.run(
      'INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data, visibility_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.slug,
        input.namespace,
        input.name,
        input.description,
        input.owner,
        input.lifecycle,
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

  async updateEntity(workspace: string, id: string, input: UpdateEntityInput) {
    this.run(
      'UPDATE entity SET slug = ?, namespace = ?, name = ?, description = ?, owner = ?, lifecycle = ?, tags = ?, links = ?, schema_id = ?, data = ?, visibility_mode = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.slug,
        input.namespace,
        input.name,
        input.description,
        input.owner,
        input.lifecycle,
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

  async replaceEntityGrants(workspace: string, entityId: string, grants: CreateEntityGrantInput[]) {
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

  async listSavedViews(workspace: string) {
    return this.all(
      'SELECT * FROM saved_view WHERE workspace = ? ORDER BY name',
      [workspace],
      sqliteMappers.savedView
    );
  }

  async getSavedView(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM saved_view WHERE workspace = ? AND id = ?',
      [workspace, id],
      sqliteMappers.savedView
    );
  }

  async createSavedView(input: CreateSavedViewInput) {
    this.run(
      'INSERT INTO saved_view (id, workspace, name, description, view_mode, filters, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        input.view_mode,
        JSON.stringify(input.filters),
        input.config ? JSON.stringify(input.config) : null,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getSavedView(input.workspace, input.id))!;
  }

  async updateSavedView(workspace: string, id: string, input: UpdateSavedViewInput) {
    const existing = await this.getSavedView(workspace, id);
    if (!existing) return null;

    this.run(
      `UPDATE saved_view
       SET name = ?,
           description = ?,
           view_mode = ?,
           filters = ?,
           config = ?,
           updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.name ?? existing.name,
        input.description === undefined ? existing.description : input.description,
        input.view_mode ?? existing.view_mode,
        input.filters ? JSON.stringify(input.filters) : JSON.stringify(existing.filters),
        input.config ? JSON.stringify(input.config) : JSON.stringify(existing.config),
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
}

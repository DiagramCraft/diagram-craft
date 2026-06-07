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
import {
  normalizePostgresError,
  PostgresDatabaseBase,
  type PostgresRowTypes
} from './postgresBase';

export class PostgresCatalogDatabase extends PostgresDatabaseBase implements CatalogDatabase {
  async resolveWorkspaceSlug(slug: string) {
    const [row] = await this.sql<{ id: string }[]>`
      SELECT id FROM workspace WHERE url_slug = ${slug}
    `;
    return row?.id ?? null;
  }

  async listSchemas(workspace: string) {
    return await this.sql<PostgresRowTypes['schema'][]>`
      SELECT * FROM entity_schema WHERE workspace = ${workspace} ORDER BY name
    `;
  }

  async getSchema(workspace: string, id: string) {
    const [row] = await this.sql<PostgresRowTypes['schema'][]>`
      SELECT * FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createSchema(input: CreateSchemaInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['schema'][]>`
        INSERT INTO entity_schema (id, workspace, name, description, fields, color, icon, default_owner, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${this.json(input.fields)}, ${input.color}, ${input.icon}, ${input.default_owner}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateSchema(workspace: string, id: string, input: UpdateSchemaInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['schema'][]>`
        UPDATE entity_schema
        SET name = ${input.name},
            description = ${input.description},
            fields = ${this.json(input.fields)},
            color = ${input.color},
            icon = ${input.icon},
            default_owner = ${input.default_owner},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteSchema(workspace: string, id: string) {
    try {
      const [row] = await this.sql<PostgresRowTypes['schema'][]>`
        DELETE FROM entity_schema
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listEnums(workspace: string) {
    return await this.sql<PostgresRowTypes['workspaceEnum'][]>`
      SELECT * FROM workspace_enum WHERE workspace = ${workspace} ORDER BY sort_order, name
    `;
  }

  async getEnum(workspace: string, id: string) {
    const [row] = await this.sql<PostgresRowTypes['workspaceEnum'][]>`
      SELECT * FROM workspace_enum WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createEnum(input: CreateEnumInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['workspaceEnum'][]>`
        INSERT INTO workspace_enum (id, workspace, name, options, sort_order, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${this.json(input.options)}, ${input.sort_order}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateEnum(workspace: string, id: string, input: UpdateEnumInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['workspaceEnum'][]>`
        UPDATE workspace_enum
        SET name = ${input.name},
            options = ${this.json(input.options)},
            sort_order = ${input.sort_order},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteEnum(workspace: string, id: string) {
    try {
      const [row] = await this.sql<PostgresRowTypes['workspaceEnum'][]>`
        DELETE FROM workspace_enum
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listEntities(workspace: string) {
    return await this.sql<PostgresRowTypes['entity'][]>`
      SELECT * FROM entity WHERE workspace = ${workspace} ORDER BY name
    `;
  }

  async getEntity(workspace: string, id: string) {
    const [row] = await this.sql<PostgresRowTypes['entity'][]>`
      SELECT * FROM entity WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createEntity(input: CreateEntityInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['entity'][]>`
        INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data, visibility_mode, created_at, updated_at)
        VALUES (
          ${input.id},
          ${input.workspace},
          ${input.slug},
          ${input.namespace},
          ${input.name},
          ${input.description},
          ${input.owner},
          ${input.lifecycle},
          ${this.json(input.tags)},
          ${this.json(input.links)},
          ${input.schema_id},
          ${this.json(input.data)},
          ${input.visibility_mode},
          ${input.created_at},
          ${input.updated_at}
        )
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateEntity(workspace: string, id: string, input: UpdateEntityInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['entity'][]>`
        UPDATE entity
        SET slug = ${input.slug},
            namespace = ${input.namespace},
            name = ${input.name},
            description = ${input.description},
            owner = ${input.owner},
            lifecycle = ${input.lifecycle},
            tags = ${this.json(input.tags)},
            links = ${this.json(input.links)},
            schema_id = ${input.schema_id},
            data = ${this.json(input.data)},
            visibility_mode = ${input.visibility_mode},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteEntity(workspace: string, id: string) {
    try {
      const [row] = await this.sql<PostgresRowTypes['entity'][]>`
        DELETE FROM entity
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listEntityGrants(workspace: string) {
    return await this.sql<PostgresRowTypes['entityGrant'][]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace}
      ORDER BY entity_id, principal_type, principal_id
    `;
  }

  async getEntityGrants(workspace: string, entityId: string) {
    return await this.sql<PostgresRowTypes['entityGrant'][]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace} AND entity_id = ${entityId}
      ORDER BY principal_type, principal_id
    `;
  }

  async replaceEntityGrants(workspace: string, entityId: string, grants: CreateEntityGrantInput[]) {
    try {
      await this.sql.begin(async tx => {
        await tx`DELETE FROM entity_grant WHERE workspace = ${workspace} AND entity_id = ${entityId}`;
        for (const grant of grants) {
          await tx`
            INSERT INTO entity_grant (id, workspace, entity_id, principal_type, principal_id, role, applies_to, created_at)
            VALUES (${grant.id}, ${workspace}, ${entityId}, ${grant.principal_type}, ${grant.principal_id}, ${grant.role}, ${grant.applies_to}, ${grant.created_at})
          `;
        }
      });
      return await this.getEntityGrants(workspace, entityId);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

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

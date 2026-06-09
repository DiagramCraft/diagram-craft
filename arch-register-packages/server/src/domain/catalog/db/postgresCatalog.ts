import type {
  CatalogDatabase,
  CreateEntityGrantInput,
  CreateEntityInput,
  CreateWorkspaceEnumInput,
  CreateEntitySchemaInput,
  EnrichedEntity,
  EntitySchemaRow,
  UpdateEntityInput,
  UpdateWorkspaceEnumInput,
  UpdateEntitySchemaInput,
  WorkspaceEnumRow,
  EntityGrantRow,
  UserPinnedEntityRow
} from './catalogDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { Entity } from '../../../types';

export class PostgresCatalogDatabase extends PostgresDatabaseBase implements CatalogDatabase {
  async resolveWorkspaceSlug(slug: string) {
    const [row] = await this.sql<{ id: string }[]>`
      SELECT id FROM workspace WHERE url_slug = ${slug}
    `;
    return row?.id ?? null;
  }

  async listSchemas(workspace: string) {
    return await this.sql<EntitySchemaRow[]>`
      SELECT * FROM entity_schema WHERE workspace = ${workspace} ORDER BY name
    `;
  }

  async getSchema(workspace: string, id: string) {
    const [row] = await this.sql<EntitySchemaRow[]>`
      SELECT * FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createSchema(input: CreateEntitySchemaInput) {
    try {
      const [row] = await this.sql<EntitySchemaRow[]>`
        INSERT INTO entity_schema (id, workspace, name, description, fields, color, icon, default_owner, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${this.json(input.fields)}, ${input.color}, ${input.icon}, ${input.default_owner}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateSchema(workspace: string, id: string, input: UpdateEntitySchemaInput) {
    try {
      const [row] = await this.sql<EntitySchemaRow[]>`
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
      const [row] = await this.sql<EntitySchemaRow[]>`
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
    return await this.sql<WorkspaceEnumRow[]>`
      SELECT * FROM workspace_enum WHERE workspace = ${workspace} ORDER BY sort_order, name
    `;
  }

  async getEnum(workspace: string, id: string) {
    const [row] = await this.sql<WorkspaceEnumRow[]>`
      SELECT * FROM workspace_enum WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createEnum(input: CreateWorkspaceEnumInput) {
    try {
      const [row] = await this.sql<WorkspaceEnumRow[]>`
        INSERT INTO workspace_enum (id, workspace, name, options, sort_order, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${this.json(input.options)}, ${input.sort_order}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateEnum(workspace: string, id: string, input: UpdateWorkspaceEnumInput) {
    try {
      const [row] = await this.sql<WorkspaceEnumRow[]>`
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
      const [row] = await this.sql<WorkspaceEnumRow[]>`
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
    return await this.sql<EnrichedEntity[]>`
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
      WHERE e.workspace = ${workspace}
      ORDER BY e.name
    `;
  }

  async getEntity(workspace: string, id: string) {
    const [row] = await this.sql<EnrichedEntity[]>`
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
      WHERE e.workspace = ${workspace} AND e.id = ${id}
    `;
    return row ?? null;
  }

  async createEntity(input: CreateEntityInput) {
    try {
      await this.sql`
        INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, visibility_mode, created_at, updated_at)
        VALUES (
          ${input.id},
          ${input.workspace},
          ${input.slug},
          ${input.namespace},
          ${input.name},
          ${input.description},
          ${input.owner},
          ${input.lifecycle},
          ${input.target_lifecycle},
          ${input.target_lifecycle_date},
          ${this.json(input.tags)},
          ${this.json(input.links)},
          ${input.schema_id},
          ${this.json(input.data)},
          ${input.visibility_mode},
          ${input.created_at},
          ${input.updated_at}
        )
      `;
      return (await this.getEntity(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateEntity(workspace: string, id: string, input: UpdateEntityInput) {
    try {
      const result = await this.sql`
        UPDATE entity
        SET slug = ${input.slug},
            namespace = ${input.namespace},
            name = ${input.name},
            description = ${input.description},
            owner = ${input.owner},
            lifecycle = ${input.lifecycle},
            target_lifecycle = ${input.target_lifecycle},
            target_lifecycle_date = ${input.target_lifecycle_date},
            tags = ${this.json(input.tags)},
            links = ${this.json(input.links)},
            schema_id = ${input.schema_id},
            data = ${this.json(input.data)},
            visibility_mode = ${input.visibility_mode},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
      `;
      if (result.count === 0) return null;
      return await this.getEntity(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteEntity(workspace: string, id: string) {
    try {
      const [row] = await this.sql<Entity[]>`
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
    return await this.sql<EntityGrantRow[]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace}
      ORDER BY entity_id, principal_type, principal_id
    `;
  }

  async getEntityGrants(workspace: string, entityId: string) {
    return await this.sql<EntityGrantRow[]>`
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

  async listPinnedEntities(userId: string, workspace: string) {
    return await this.sql<UserPinnedEntityRow[]>`
      SELECT * FROM user_pinned_entity
      WHERE user_id = ${userId} AND workspace = ${workspace}
      ORDER BY created_at DESC
    `;
  }

  async getPinnedEntity(userId: string, workspace: string, entityId: string) {
    const [row] = await this.sql<UserPinnedEntityRow[]>`
      SELECT * FROM user_pinned_entity
      WHERE user_id = ${userId} AND workspace = ${workspace} AND entity_id = ${entityId}
    `;
    return row ?? null;
  }

  async createPinnedEntity(input: import('./catalogDatabase').CreateUserPinnedEntityInput) {
    try {
      const [row] = await this.sql<UserPinnedEntityRow[]>`
        INSERT INTO user_pinned_entity (user_id, workspace, entity_id, created_at)
        VALUES (${input.user_id}, ${input.workspace}, ${input.entity_id}, ${input.created_at})
        ON CONFLICT (user_id, workspace, entity_id) DO UPDATE
        SET created_at = user_pinned_entity.created_at
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deletePinnedEntity(userId: string, workspace: string, entityId: string) {
    try {
      const [row] = await this.sql<UserPinnedEntityRow[]>`
        DELETE FROM user_pinned_entity
        WHERE user_id = ${userId} AND workspace = ${workspace} AND entity_id = ${entityId}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}

import type {
  CatalogDatabase,
  EntityGrantDbCretae,
  EntityDbCreate,
  WorkspaceEnumDbCreate,
  SchemaDbCreate,
  EntityDbResult,
  SchemaDbResult,
  EntityDbUpdate,
  WorkspaceEnumDbUpdate,
  SchemaDbUpdate,
  WorkspaceEnumDbResult,
  EntityGrantDbResult,
  PinnedEntityDbResult,
  Entity,
  PinnedEntityDbCreate,
  EntitySnapshotDbCreate,
  EntitySnapshotDbResult
} from './catalogDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresCatalogDatabase extends PostgresDatabaseBase implements CatalogDatabase {
  async resolveWorkspaceSlug(slug: string) {
    const [row] = await this.sql<{ id: string }[]>`
      SELECT id FROM workspace WHERE url_slug = ${slug}
    `;
    return row?.id ?? null;
  }

  async listSchemas(workspace: string) {
    return await this.sql<SchemaDbResult[]>`
      SELECT * FROM entity_schema WHERE workspace = ${workspace} ORDER BY name
    `;
  }

  async getSchema(workspace: string, id: string) {
    const [row] = await this.sql<SchemaDbResult[]>`
      SELECT * FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createSchema(input: SchemaDbCreate) {
    try {
      const [row] = await this.sql<SchemaDbResult[]>`
        INSERT INTO entity_schema (id, workspace, name, description, fields, color, icon, default_owner, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${this.json(input.fields)}, ${input.color}, ${input.icon}, ${input.default_owner}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateSchema(workspace: string, id: string, input: SchemaDbUpdate) {
    try {
      const [row] = await this.sql<SchemaDbResult[]>`
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
      const [row] = await this.sql<SchemaDbResult[]>`
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
    return await this.sql<WorkspaceEnumDbResult[]>`
      SELECT * FROM workspace_enum WHERE workspace = ${workspace} ORDER BY sort_order, name
    `;
  }

  async getEnum(workspace: string, id: string) {
    const [row] = await this.sql<WorkspaceEnumDbResult[]>`
      SELECT * FROM workspace_enum WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createEnum(input: WorkspaceEnumDbCreate) {
    try {
      const [row] = await this.sql<WorkspaceEnumDbResult[]>`
        INSERT INTO workspace_enum (id, workspace, name, options, sort_order, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${this.json(input.options)}, ${input.sort_order}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateEnum(workspace: string, id: string, input: WorkspaceEnumDbUpdate) {
    try {
      const [row] = await this.sql<WorkspaceEnumDbResult[]>`
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
      const [row] = await this.sql<WorkspaceEnumDbResult[]>`
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
    return await this.sql<EntityDbResult[]>`
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
    const [row] = await this.sql<EntityDbResult[]>`
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

  async createEntity(input: EntityDbCreate) {
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

  async updateEntity(workspace: string, id: string, input: EntityDbUpdate) {
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
    return await this.sql<EntityGrantDbResult[]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace}
      ORDER BY entity_id, principal_type, principal_id
    `;
  }

  async getEntityGrants(workspace: string, entityId: string) {
    return await this.sql<EntityGrantDbResult[]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace} AND entity_id = ${entityId}
      ORDER BY principal_type, principal_id
    `;
  }

  async replaceEntityGrants(workspace: string, entityId: string, grants: EntityGrantDbCretae[]) {
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
    return await this.sql<PinnedEntityDbResult[]>`
      SELECT * FROM user_pinned_entity
      WHERE user_id = ${userId} AND workspace = ${workspace}
      ORDER BY created_at DESC
    `;
  }

  async getPinnedEntity(userId: string, workspace: string, entityId: string) {
    const [row] = await this.sql<PinnedEntityDbResult[]>`
      SELECT * FROM user_pinned_entity
      WHERE user_id = ${userId} AND workspace = ${workspace} AND entity_id = ${entityId}
    `;
    return row ?? null;
  }

  async createPinnedEntity(input: PinnedEntityDbCreate) {
    try {
      const [row] = await this.sql<PinnedEntityDbResult[]>`
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
      const [row] = await this.sql<PinnedEntityDbResult[]>`
        DELETE FROM user_pinned_entity
        WHERE user_id = ${userId} AND workspace = ${workspace} AND entity_id = ${entityId}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async createSnapshot(input: EntitySnapshotDbCreate) {
    try {
      const [row] = await this.sql<EntitySnapshotDbResult[]>`
        INSERT INTO entity_snapshot (id, workspace, entity_id, status, project_id, target_date, commit_message, created_at, created_by, base_state, proposed_state)
        VALUES (${input.id}, ${input.workspace}, ${input.entity_id}, ${input.status}, ${input.project_id}, ${input.target_date}, ${input.commit_message}, ${input.created_at}, ${input.created_by}, ${this.json(input.base_state)}, ${input.proposed_state != null ? this.json(input.proposed_state) : null})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listSnapshots(workspace: string, entityId: string) {
    return await this.sql<EntitySnapshotDbResult[]>`
      SELECT * FROM entity_snapshot
      WHERE workspace = ${workspace} AND entity_id = ${entityId}
      ORDER BY created_at DESC
    `;
  }

  async pruneAutosaveSnapshots(workspace: string, entityId: string, keepCount: number) {
    await this.sql`
      DELETE FROM entity_snapshot
      WHERE workspace = ${workspace} AND entity_id = ${entityId} AND status = 'autosave'
        AND id NOT IN (
          SELECT id FROM entity_snapshot
          WHERE workspace = ${workspace} AND entity_id = ${entityId} AND status = 'autosave'
          ORDER BY created_at DESC
          LIMIT ${keepCount}
        )
    `;
  }

  async promoteSnapshot(workspace: string, snapshotId: string, commitMessage: string | null) {
    const [row] = await this.sql<EntitySnapshotDbResult[]>`
      UPDATE entity_snapshot
      SET status = 'saved_version', commit_message = ${commitMessage}
      WHERE id = ${snapshotId} AND workspace = ${workspace} AND status = 'autosave'
      RETURNING *
    `;
    return row ?? null;
  }
}

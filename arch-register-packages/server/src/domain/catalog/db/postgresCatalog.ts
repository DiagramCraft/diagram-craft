import type {
  CatalogDatabase,
  EntityGrantDbCretae,
  EntityDbCreate,
  EntityDbResult,
  EntityListDbFilters,
  EntityListDbPagination,
  SchemaDbResult,
  EntityDbUpdate,
  WorkspaceEnumDbCreate,
  WorkspaceEnumDbResult,
  WorkspaceEnumDbUpdate,
  SchemaDbCreate,
  SchemaDbUpdate,
  EntityGrantDbResult,
  PinnedEntityDbResult,
  PinnedEntityDbCreate,
  EntitySnapshotDbCreate,
  EntitySnapshotDbResult
} from './catalogDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { ENTITY_DEFAULTS } from '../../../constants';
import { isUuidLike } from '../../../utils/publicIds';
import {
  ENTITY_BUILTIN_COLUMNS,
  isValidFieldId,
  escapeLike,
  buildConditionClause
} from './filterBuilder';

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

  async getSchemaByKeyPrefix(prefix: string) {
    const [row] = await this.sql<SchemaDbResult[]>`
      SELECT * FROM entity_schema WHERE key_prefix = ${prefix}
    `;
    return row ?? null;
  }

  async createSchema(input: SchemaDbCreate) {
    try {
      const rows = (await this.sql`
        INSERT INTO entity_schema (id, workspace, name, description, fields, color, icon, default_owner, key_prefix, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${this.json(input.fields)}, ${input.color}, ${input.icon}, ${input.default_owner}, ${input.key_prefix}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `) as SchemaDbResult[];
      const [row] = rows;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateSchema(workspace: string, id: string, input: SchemaDbUpdate) {
    try {
      const rows = (await this.sql`
        UPDATE entity_schema
        SET name = ${input.name},
            description = ${input.description},
            fields = ${this.json(input.fields)},
            color = ${input.color},
            icon = ${input.icon},
            default_owner = ${input.default_owner},
            key_prefix = ${input.key_prefix},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `) as SchemaDbResult[];
      const [row] = rows;
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

  async listEntitiesPaginated(
    workspace: string,
    filters?: EntityListDbFilters,
    pagination?: EntityListDbPagination
  ) {
    const limit = pagination?.limit ?? ENTITY_DEFAULTS.PAGE_SIZE;
    const offset = pagination?.offset ?? 0;
    const whereParts: string[] = ['e.workspace = $1 AND e.deleted_at IS NULL'];
    const params: unknown[] = [workspace];
    const addParam = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    if (filters?.schemaId) whereParts.push(`e.schema_id = ${addParam(filters.schemaId)}`);
    if (filters?.owner) whereParts.push(`e.owner = ${addParam(filters.owner)}`);
    if (filters?.lifecycle) whereParts.push(`e.lifecycle = ${addParam(filters.lifecycle)}`);
    if (filters?.q?.trim()) {
      const pat = `%${escapeLike(filters.q.trim())}%`;
      whereParts.push(
        `(e.name ILIKE ${addParam(pat)} OR e.slug ILIKE ${addParam(pat)} OR e.description ILIKE ${addParam(pat)})`
      );
    }
    for (const cond of filters?.conditions ?? []) {
      const col =
        ENTITY_BUILTIN_COLUMNS[cond.fieldId] ??
        (isValidFieldId(cond.fieldId) ? `(e.data->>'${cond.fieldId}')` : null);
      if (!col) continue;
      const clause = buildConditionClause(col, cond, addParam, 'postgres');
      if (clause) whereParts.push(clause);
    }

    return this.sql.unsafe<EntityDbResult[]>(
      `SELECT e.*,
        wo.name   AS owner_name,
        ls.label  AS lifecycle_label,
        tls.label AS target_lifecycle_label,
        es.name   AS schema_name
       FROM entity e
       LEFT JOIN workspace_owner wo            ON wo.id  = e.owner
       LEFT JOIN workspace_lifecycle_state ls  ON ls.id  = e.lifecycle
       LEFT JOIN workspace_lifecycle_state tls ON tls.id = e.target_lifecycle
       JOIN entity_schema es ON es.id = e.schema_id
       WHERE ${whereParts.join(' AND ')}
       ORDER BY e.name, e.id
       LIMIT ${limit}
       OFFSET ${offset}`,
      // postgres.js accepts string | number | boolean | null | Date; cast from unknown[] is safe
      // because all values we push are those types
      params as Parameters<typeof this.sql.unsafe>[1]
    );
  }

  async listEntities(workspace: string, filters?: EntityListDbFilters) {
    const pageSize = ENTITY_DEFAULTS.PAGE_SIZE;
    const rows: EntityDbResult[] = [];
    let offset = 0;

    while (true) {
      const page = await this.listEntitiesPaginated(workspace, filters, {
        limit: pageSize,
        offset
      });
      rows.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    return rows;
  }

  async getEntity(workspace: string, identifier: string) {
    if (!isUuidLike(identifier)) {
      return this.getEntityByPublicId(workspace, identifier);
    }
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
      WHERE e.workspace = ${workspace} AND e.id = ${identifier} AND e.deleted_at IS NULL
    `;
    return row ?? null;
  }

  private async getEntityByPublicId(workspace: string, publicId: string) {
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
      WHERE e.public_id = ${publicId} AND e.workspace = ${workspace} AND e.deleted_at IS NULL
    `;
    return row ?? null;
  }

  async createEntity(input: EntityDbCreate) {
    try {
      await this.sql`
        INSERT INTO entity (id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, visibility_mode, created_at, updated_at)
        VALUES (
          ${input.id},
          ${input.workspace},
          ${input.public_id},
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
      const row = await this.getEntity(workspace, id);
      if (!row) return null;
      await this.sql`
        UPDATE entity
        SET deleted_at = NOW(), owner = NULL, lifecycle = NULL, target_lifecycle = NULL
        WHERE workspace = ${workspace} AND id = ${id}
      `;
      return row;
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
        INSERT INTO entity_snapshot (id, workspace, entity_id, status, project_id, target_date, commit_message, created_at, created_by, created_by_name, base_state, proposed_state)
        VALUES (${input.id}, ${input.workspace}, ${input.entity_id}, ${input.status}, ${input.project_id}, ${input.target_date}, ${input.commit_message}, ${input.created_at}, ${input.created_by}, ${input.created_by_name}, ${this.json(input.base_state)}, ${input.proposed_state != null ? this.json(input.proposed_state) : null})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getSnapshot(workspace: string, snapshotId: string) {
    const [row] = await this.sql<EntitySnapshotDbResult[]>`
      SELECT s.*, u.display_name as created_by_name
      FROM entity_snapshot s
      LEFT JOIN users u ON u.id = s.created_by
      WHERE s.workspace = ${workspace} AND s.id = ${snapshotId}
    `;
    return row ?? null;
  }


  async listSnapshots(workspace: string, entityId: string) {
    return await this.sql<EntitySnapshotDbResult[]>`
      SELECT s.*, u.display_name as created_by_name
      FROM entity_snapshot s
      LEFT JOIN users u ON u.id = s.created_by
      WHERE s.workspace = ${workspace} AND s.entity_id = ${entityId}
      ORDER BY s.created_at DESC
    `;
  }

  async listSnapshotsByProject(workspace: string, projectId: string) {
    return await this.sql<EntitySnapshotDbResult[]>`
      SELECT s.*, u.display_name as created_by_name
      FROM entity_snapshot s
      INNER JOIN project p ON p.id = s.project_id
      LEFT JOIN users u ON u.id = s.created_by
      WHERE s.workspace = ${workspace}
        AND p.workspace = ${workspace}
        AND (p.id::text = ${projectId} OR p.public_id = ${projectId})
        AND s.status IN ('future_update', 'applied')
      ORDER BY s.target_date ASC NULLS LAST, s.created_at DESC
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
      WITH updated AS (
        UPDATE entity_snapshot
        SET status = 'saved_version', commit_message = ${commitMessage}
        WHERE id = ${snapshotId} AND workspace = ${workspace} AND status = 'autosave'
        RETURNING *
      )
      SELECT u.*, us.display_name as created_by_name
      FROM updated u
      LEFT JOIN users us ON us.id = u.created_by
    `;
    return row ?? null;
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
    const existing = await this.sql<EntitySnapshotDbResult[]>`
      SELECT * FROM entity_snapshot WHERE id = ${snapshotId} AND workspace = ${workspace}
    `;
    if (existing[0]?.status !== 'future_update') return null;

    const [row] = await this.sql<EntitySnapshotDbResult[]>`
      UPDATE entity_snapshot
      SET
        proposed_state = ${updates.proposed_state !== undefined ? this.json(updates.proposed_state) : this.sql`proposed_state`},
        target_date = ${updates.target_date !== undefined ? updates.target_date : this.sql`target_date`},
        commit_message = ${updates.commit_message !== undefined ? updates.commit_message : this.sql`commit_message`}
      WHERE id = ${snapshotId} AND workspace = ${workspace} AND status = 'future_update'
      RETURNING *
    `;
    return row ?? null;
  }

  async applySnapshot(workspace: string, snapshotId: string) {
    const [row] = await this.sql<EntitySnapshotDbResult[]>`
      UPDATE entity_snapshot
      SET status = 'applied'
      WHERE id = ${snapshotId} AND workspace = ${workspace} AND status = 'future_update'
      RETURNING *
    `;
    return row ?? null;
  }
}

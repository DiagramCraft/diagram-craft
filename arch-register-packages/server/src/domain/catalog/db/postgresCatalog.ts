import type {
  CatalogDatabase,
  EntityGrantDbCretae,
  EntityDbCreate,
  EntityListDbFilters,
  EntityListDbPagination,
  EntityDbUpdate,
  WorkspaceEnumDbCreate,
  WorkspaceEnumDbUpdate,
  SchemaDbCreate,
  SchemaDbUpdate,
  SchemaVersionDbCreate,
  PinnedEntityDbCreate,
  EntitySnapshotDbCreate,
  TimelineMarkerDbResult
} from './catalogDatabase';
import {
  ENTITY_SELECT_SQL,
  ENTITY_SNAPSHOT_SELECT_SQL,
  catalogMappers,
  resolveEntityListPagination
} from './catalogDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { isUuidLike } from '../../../utils/publicIds';
import {
  ENTITY_BUILTIN_COLUMNS,
  ENTITY_ARRAY_COLUMNS,
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
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_schema WHERE workspace = ${workspace} ORDER BY name
    `;
    return mapDatabaseRows(rows, catalogMappers.schema);
  }

  async getSchema(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? catalogMappers.schema(row) : null;
  }

  async getSchemaByKeyPrefix(prefix: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_schema WHERE key_prefix = ${prefix}
    `;
    return row ? catalogMappers.schema(row) : null;
  }

  async createSchema(input: SchemaDbCreate) {
    try {
      const rows = (await this.sql`
        INSERT INTO entity_schema (id, workspace, name, description, fields, templates, color, icon, default_owner, key_prefix, entity_approval_policy, deprecation_policy, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${this.json(input.fields)}, ${this.json(input.templates ?? [])}, ${input.color}, ${input.icon}, ${input.default_owner}, ${input.key_prefix}, ${input.entity_approval_policy ?? 'disabled'}, ${input.deprecation_policy ?? 'disabled'}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `) as DatabaseRow[];
      const [row] = rows;
      return catalogMappers.schema(row!);
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
            templates = ${this.json(input.templates ?? [])},
            color = ${input.color},
            icon = ${input.icon},
            default_owner = ${input.default_owner},
            key_prefix = ${input.key_prefix},
            entity_approval_policy = COALESCE(${input.entity_approval_policy ?? null}, entity_approval_policy),
            deprecation_policy = COALESCE(${input.deprecation_policy ?? null}, deprecation_policy),
            version = COALESCE(${input.version ?? null}::integer, version),
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `) as DatabaseRow[];
      const [row] = rows;
      return row ? catalogMappers.schema(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteSchema(workspace: string, id: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM entity_schema
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? catalogMappers.schema(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listSchemaVersions(workspace: string, schemaId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_schema_version
      WHERE workspace = ${workspace} AND schema_id = ${schemaId}
      ORDER BY version DESC
    `;
    return mapDatabaseRows(rows, catalogMappers.schemaVersion);
  }

  async createSchemaVersion(input: SchemaVersionDbCreate) {
    const [row] = (await this.sql`
      INSERT INTO entity_schema_version
        (id, workspace, schema_id, version, name, description, fields, templates, color, icon, change_summary, created_by, created_at)
      VALUES
        (${input.id}, ${input.workspace}, ${input.schema_id}, ${input.version}, ${input.name}, ${input.description}, ${this.json(input.fields)}, ${this.json(input.templates)}, ${input.color}, ${input.icon}, ${this.json(input.change_summary)}, ${input.created_by}, ${input.created_at})
      RETURNING *
    `) as DatabaseRow[];
    return catalogMappers.schemaVersion(row!);
  }

  async renameEntityDataField(
    workspace: string,
    schemaId: string,
    oldFieldId: string,
    newFieldId: string
  ) {
    const rows = (await this.sql`
      UPDATE entity
      SET data = (data - ${oldFieldId}::text)
        || jsonb_build_object(${newFieldId}::text, data -> ${oldFieldId}::text)
      WHERE workspace = ${workspace} AND schema_id = ${schemaId} AND data ? ${oldFieldId}::text
      RETURNING id
    `) as DatabaseRow[];
    return rows.length;
  }

  async removeEntityDataField(workspace: string, schemaId: string, fieldId: string) {
    const rows = (await this.sql`
      UPDATE entity
      SET data = data - ${fieldId}::text
      WHERE workspace = ${workspace} AND schema_id = ${schemaId} AND data ? ${fieldId}::text
      RETURNING id
    `) as DatabaseRow[];
    return rows.length;
  }

  async listEnums(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_enum WHERE workspace = ${workspace} ORDER BY sort_order, name
    `;
    return mapDatabaseRows(rows, catalogMappers.workspaceEnum);
  }

  async getEnum(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_enum WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? catalogMappers.workspaceEnum(row) : null;
  }

  async createEnum(input: WorkspaceEnumDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO workspace_enum (id, workspace, name, options, sort_order, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${this.json(input.options)}, ${input.sort_order}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return catalogMappers.workspaceEnum(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateEnum(workspace: string, id: string, input: WorkspaceEnumDbUpdate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE workspace_enum
        SET name = ${input.name},
            options = ${this.json(input.options)},
            sort_order = ${input.sort_order},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? catalogMappers.workspaceEnum(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteEnum(workspace: string, id: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM workspace_enum
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? catalogMappers.workspaceEnum(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listEntities(workspace: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ENTITY_SELECT_SQL} WHERE e.workspace = $1 AND e.deleted_at IS NULL ORDER BY e.name, e.id`,
      [workspace]
    );
    return mapDatabaseRows(rows, catalogMappers.enrichedEntity);
  }

  async listEntitiesPaginated(
    workspace: string,
    filters?: EntityListDbFilters,
    pagination?: EntityListDbPagination
  ) {
    const { limit, offset } = resolveEntityListPagination(pagination);
    const whereParts: string[] = ['e.workspace = $1 AND e.deleted_at IS NULL'];
    const params: unknown[] = [workspace];
    const addParam = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    if (filters?.schemaId) whereParts.push(`e.schema_id = ${addParam(filters.schemaId)}`);
    if (filters?.owner) whereParts.push(`e.owner = ${addParam(filters.owner)}`);
    if (filters?.lifecycle) whereParts.push(`e.lifecycle = ${addParam(filters.lifecycle)}`);
    if (filters?.projectScope === 'project' && filters.projectId) {
      const projectIdParam = addParam(filters.projectId);
      whereParts.push(
        `(e.project_id = ${projectIdParam} OR e.id IN (SELECT entity_id FROM project_entity WHERE workspace = e.workspace AND project_id = ${projectIdParam}))`
      );
    } else {
      whereParts.push('e.project_id IS NULL');
    }
    if (filters?.q?.trim()) {
      const pat = `%${escapeLike(filters.q.trim())}%`;
      whereParts.push(
        `(e.name ILIKE ${addParam(pat)} OR e.slug ILIKE ${addParam(pat)} OR e.description ILIKE ${addParam(pat)})`
      );
    }
    for (const cond of filters?.conditions ?? []) {
      // Guard against prototype pollution: only accept own properties from ENTITY_BUILTIN_COLUMNS
      // For custom fields, also verify they don't match Object.prototype property names
      let col: string | null = null;
      let kind: 'scalar' | 'array' = 'scalar';
      if (Object.hasOwn(ENTITY_BUILTIN_COLUMNS, cond.fieldId)) {
        col = ENTITY_BUILTIN_COLUMNS[cond.fieldId] ?? null;
      } else if (Object.hasOwn(ENTITY_ARRAY_COLUMNS, cond.fieldId)) {
        col = ENTITY_ARRAY_COLUMNS[cond.fieldId] ?? null;
        kind = 'array';
      } else if (isValidFieldId(cond.fieldId) && !Object.hasOwn(Object.prototype, cond.fieldId)) {
        col = `(e.data->>'${cond.fieldId}')`;
      }
      if (!col) continue;
      const clause = buildConditionClause(col, cond, addParam, 'postgres', kind);
      if (clause) whereParts.push(clause);
    }

    const limitParam = addParam(limit);
    const offsetParam = addParam(offset);
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ENTITY_SELECT_SQL} WHERE ${whereParts.join(' AND ')}
       ORDER BY e.name, e.id
       LIMIT ${limitParam}
       OFFSET ${offsetParam}`,
      // postgres.js accepts string | number | boolean | null | Date; cast from unknown[] is safe
      // because all values we push are those types
      params as Parameters<typeof this.sql.unsafe>[1]
    );
    return mapDatabaseRows(rows, catalogMappers.enrichedEntity);
  }

  async getEntity(workspace: string, identifier: string) {
    if (!isUuidLike(identifier)) {
      return this.getEntityByPublicId(workspace, identifier);
    }
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ENTITY_SELECT_SQL} WHERE e.workspace = $1 AND e.id = $2 AND e.deleted_at IS NULL`,
      [workspace, identifier]
    );
    return rows[0] ? catalogMappers.enrichedEntity(rows[0]) : null;
  }

  private async getEntityByPublicId(workspace: string, publicId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ENTITY_SELECT_SQL} WHERE e.public_id = $1 AND e.workspace = $2 AND e.deleted_at IS NULL`,
      [publicId, workspace]
    );
    return rows[0] ? catalogMappers.enrichedEntity(rows[0]) : null;
  }

  async createEntity(input: EntityDbCreate) {
    try {
      await this.sql`
        INSERT INTO entity (id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, generated_metadata, visibility_mode, version, approval_policy_override, created_at, updated_at)
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
          ${this.json(input.generated_metadata ?? {})},
          ${input.visibility_mode},
          ${input.version ?? 1},
          ${input.approval_policy_override ?? null},
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
            generated_metadata = COALESCE(${input.generated_metadata !== undefined ? this.json(input.generated_metadata) : null}::jsonb, generated_metadata),
            visibility_mode = ${input.visibility_mode},
            version = version + 1,
            approval_policy_override = COALESCE(${input.approval_policy_override ?? null}, approval_policy_override),
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
      `;
      if (result.count === 0) return null;
      return await this.getEntity(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateEntityIfVersion(
    workspace: string,
    id: string,
    input: EntityDbUpdate,
    expectedVersion: number
  ) {
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
            generated_metadata = COALESCE(${input.generated_metadata !== undefined ? this.json(input.generated_metadata) : null}::jsonb, generated_metadata),
            visibility_mode = ${input.visibility_mode},
            version = version + 1,
            approval_policy_override = COALESCE(${input.approval_policy_override ?? null}, approval_policy_override),
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id} AND version = ${expectedVersion}
      `;
      if (result.count === 0) return null;
      return await this.getEntity(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async setEntityApprovalPolicyOverride(
    workspace: string,
    id: string,
    override: 'required' | 'disabled' | null
  ) {
    try {
      const result = await this.sql`
        UPDATE entity
        SET approval_policy_override = ${override}, version = version + 1, updated_at = NOW()
        WHERE workspace = ${workspace} AND id = ${id}
      `;
      return result.count === 0 ? null : await this.getEntity(workspace, id);
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
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace}
      ORDER BY entity_id, principal_type, principal_id
    `;
    return mapDatabaseRows(rows, catalogMappers.entityGrant);
  }

  async getEntityGrants(workspace: string, entityId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace} AND entity_id = ${entityId}
      ORDER BY principal_type, principal_id
    `;
    return mapDatabaseRows(rows, catalogMappers.entityGrant);
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
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM user_pinned_entity
      WHERE user_id = ${userId} AND workspace = ${workspace}
      ORDER BY created_at DESC
    `;
    return mapDatabaseRows(rows, catalogMappers.pinnedEntity);
  }

  async getPinnedEntity(userId: string, workspace: string, entityId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM user_pinned_entity
      WHERE user_id = ${userId} AND workspace = ${workspace} AND entity_id = ${entityId}
    `;
    return row ? catalogMappers.pinnedEntity(row) : null;
  }

  async createPinnedEntity(input: PinnedEntityDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO user_pinned_entity (user_id, workspace, entity_id, created_at)
        VALUES (${input.user_id}, ${input.workspace}, ${input.entity_id}, ${input.created_at})
        ON CONFLICT (user_id, workspace, entity_id) DO UPDATE
        SET created_at = user_pinned_entity.created_at
        RETURNING *
      `;
      return catalogMappers.pinnedEntity(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deletePinnedEntity(userId: string, workspace: string, entityId: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM user_pinned_entity
        WHERE user_id = ${userId} AND workspace = ${workspace} AND entity_id = ${entityId}
        RETURNING *
      `;
      return row ? catalogMappers.pinnedEntity(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async createSnapshot(input: EntitySnapshotDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO entity_snapshot (id, workspace, entity_id, status, project_id, target_date, milestone_id, commit_message, created_at, created_by, created_by_name, base_state, proposed_state)
        VALUES (${input.id}, ${input.workspace}, ${input.entity_id}, ${input.status}, ${input.project_id}, ${input.target_date}, ${input.milestone_id}, ${input.commit_message}, ${input.created_at}, ${input.created_by}, ${input.created_by_name}, ${this.json(input.base_state)}, ${input.proposed_state != null ? this.json(input.proposed_state) : null})
        RETURNING *
      `;
      return catalogMappers.entitySnapshot(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getSnapshot(workspace: string, snapshotId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ENTITY_SNAPSHOT_SELECT_SQL} WHERE s.workspace = $1 AND s.id = $2`,
      [workspace, snapshotId]
    );
    return rows[0] ? catalogMappers.entitySnapshot(rows[0]) : null;
  }

  async listSnapshots(workspace: string, entityId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ENTITY_SNAPSHOT_SELECT_SQL} WHERE s.workspace = $1 AND s.entity_id = $2 ORDER BY s.created_at DESC`,
      [workspace, entityId]
    );
    return mapDatabaseRows(rows, catalogMappers.entitySnapshot);
  }

  async listSnapshotsByProject(workspace: string, projectId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ENTITY_SNAPSHOT_SELECT_SQL}
       INNER JOIN project p ON p.id = s.project_id
       WHERE s.workspace = $1
         AND p.workspace = $1
         AND (p.id::text = $2 OR p.public_id = $2)
         AND s.status IN ('future_update', 'applied')
       ORDER BY s.target_date ASC NULLS LAST, s.created_at DESC`,
      [workspace, projectId]
    );
    return mapDatabaseRows(rows, catalogMappers.entitySnapshot);
  }

  async listSnapshotsAsOf(workspace: string, asOf: Date, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    const rows = await this.sql<DatabaseRow[]>`
      SELECT s.*, u.display_name as created_by_name
      FROM entity_snapshot s
      LEFT JOIN users u ON u.id = s.created_by
      LEFT JOIN project_milestone m ON m.id = s.milestone_id
      WHERE s.workspace = ${workspace}
        AND (
          (s.status IN ('autosave', 'saved_version', 'deleted') AND s.created_at <= ${asOf})
          OR (s.status = 'future_update' AND COALESCE(s.target_date, m.target_date) <= ${asOf} AND s.created_at <= ${asOf})
        )
        ${entityIds != null ? this.sql`AND s.entity_id = ANY(${entityIds})` : this.sql``}
      ORDER BY s.entity_id, s.created_at ASC
    `;
    return mapDatabaseRows(rows, catalogMappers.entitySnapshot);
  }

  async listEntityIdsWithAnySnapshot(workspace: string, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    // Only 'autosave'/'saved_version'/'deleted' count as "own history" checkpoints — a
    // 'future_update' snapshot alone doesn't give us any real baseline state to reconstruct
    // from, so it must not suppress the live-state fallback.
    const rows = await this.sql<{ entity_id: string }[]>`
      SELECT DISTINCT entity_id FROM entity_snapshot
      WHERE workspace = ${workspace}
        AND status IN ('autosave', 'saved_version', 'deleted')
      ${entityIds != null ? this.sql`AND entity_id = ANY(${entityIds})` : this.sql``}
    `;
    return rows.map(r => r.entity_id);
  }

  async listTimelineMarkers(workspace: string) {
    return await this.sql<TimelineMarkerDbResult[]>`
      SELECT date, type, COUNT(*)::int AS count FROM (
        SELECT target_date::text AS date, 'future_update' AS type
        FROM entity_snapshot
        WHERE workspace = ${workspace} AND status = 'future_update' AND target_date IS NOT NULL
        UNION ALL
        SELECT created_at::date::text AS date, 'saved_version' AS type
        FROM entity_snapshot
        WHERE workspace = ${workspace} AND status = 'saved_version'
        UNION ALL
        SELECT target_date::text AS date, 'applied' AS type
        FROM entity_snapshot
        WHERE workspace = ${workspace} AND status = 'applied' AND target_date IS NOT NULL
      ) markers
      GROUP BY date, type
      ORDER BY date ASC
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
    const [row] = await this.sql<DatabaseRow[]>`
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
    return row ? catalogMappers.entitySnapshot(row) : null;
  }

  async updateSnapshot(
    workspace: string,
    snapshotId: string,
    updates: {
      proposed_state?: Record<string, unknown>;
      target_date?: string | null;
      milestone_id?: string | null;
      commit_message?: string | null;
    }
  ) {
    const existing = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_snapshot WHERE id = ${snapshotId} AND workspace = ${workspace}
    `;
    if (String(existing[0]?.['status']) !== 'future_update') return null;

    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE entity_snapshot
      SET
        proposed_state = ${updates.proposed_state !== undefined ? this.json(updates.proposed_state) : this.sql`proposed_state`},
        target_date = ${updates.target_date !== undefined ? updates.target_date : this.sql`target_date`},
        milestone_id = ${updates.milestone_id !== undefined ? updates.milestone_id : this.sql`milestone_id`},
        commit_message = ${updates.commit_message !== undefined ? updates.commit_message : this.sql`commit_message`}
      WHERE id = ${snapshotId} AND workspace = ${workspace} AND status = 'future_update'
      RETURNING *
    `;
    return row ? catalogMappers.entitySnapshot(row) : null;
  }

  async deleteSnapshot(workspace: string, snapshotId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      DELETE FROM entity_snapshot
      WHERE id = ${snapshotId} AND workspace = ${workspace} AND status = 'future_update'
      RETURNING *
    `;
    return row ? catalogMappers.entitySnapshot(row) : null;
  }

  async reassignSnapshotsFromMilestone(
    workspace: string,
    milestoneId: string,
    backfillTargetDate: string | null
  ) {
    await this.sql`
      UPDATE entity_snapshot
      SET milestone_id = NULL, target_date = ${backfillTargetDate}
      WHERE workspace = ${workspace} AND milestone_id = ${milestoneId}
    `;
  }

  async applySnapshot(workspace: string, snapshotId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE entity_snapshot
      SET status = 'applied'
      WHERE id = ${snapshotId} AND workspace = ${workspace} AND status = 'future_update'
      RETURNING *
    `;
    return row ? catalogMappers.entitySnapshot(row) : null;
  }
}

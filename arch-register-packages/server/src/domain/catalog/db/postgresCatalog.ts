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
  EntityVersionDbCreate,
  EntityVersionKind,
  TimelineMarkerDbResult
} from './catalogDatabase';
import { ENTITY_SELECT_SQL, catalogMappers, resolveEntityListPagination } from './catalogDatabase';
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

  async runCompiledEntityQuery(sql: string, params: unknown[]) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      sql,
      params as Parameters<typeof this.sql.unsafe>[1]
    );
    return mapDatabaseRows(rows, catalogMappers.entityQuery);
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
    if (filters?.projectId) {
      const projectIdParam = addParam(filters.projectId);
      if (filters.projectScope === 'project') {
        whereParts.push(
          `(e.project_id = ${projectIdParam} OR e.id IN (SELECT entity_id FROM project_entity WHERE workspace = e.workspace AND project_id = ${addParam(filters.projectId)}))`
        );
      } else {
        whereParts.push(`(e.project_id IS NULL OR e.project_id = ${projectIdParam})`);
      }
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
        INSERT INTO entity (id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, generated_metadata, project_id, version, approval_policy_override, completeness, created_at, updated_at)
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
          ${input.project_id},
          ${input.version ?? 1},
          ${input.approval_policy_override ?? null},
          ${input.completeness},
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
            project_id = ${input.project_id},
            version = version + 1,
            approval_policy_override = COALESCE(${input.approval_policy_override ?? null}, approval_policy_override),
            completeness = ${input.completeness},
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
            project_id = ${input.project_id},
            version = version + 1,
            approval_policy_override = COALESCE(${input.approval_policy_override ?? null}, approval_policy_override),
            completeness = ${input.completeness},
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

  // System-maintained recompute only (schema requirementLevel changes, backfill/scan jobs) — does
  // not bump `version` or `updated_at`, since it isn't a user edit and must not trip optimistic
  // concurrency checks on a concurrent user update, or create a new entity_version snapshot.
  async updateEntityCompleteness(workspace: string, id: string, completeness: number) {
    await this.sql`
      UPDATE entity
      SET completeness = ${completeness}
      WHERE workspace = ${workspace} AND id = ${id} AND completeness != ${completeness}
    `;
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

  async createEntityVersion(input: EntityVersionDbCreate) {
    const [row] = (await this.sql`
      INSERT INTO entity_version (id, workspace, entity_id, version_number, kind, commit_message, created_at, created_by, state, applied_case_revision_id)
      VALUES (${input.id}, ${input.workspace}, ${input.entity_id}, ${input.version_number}, ${input.kind}, ${input.commit_message}, ${input.created_at}, ${input.created_by}, ${this.json(input.state)}, ${input.applied_case_revision_id})
      RETURNING *
    `) as DatabaseRow[];
    return catalogMappers.entityVersion(row!);
  }

  async listEntityVersions(workspace: string, entityId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT v.*, u.display_name AS created_by_name FROM entity_version v
      LEFT JOIN users u ON u.id = v.created_by
      WHERE v.workspace = ${workspace} AND v.entity_id = ${entityId}
      ORDER BY v.created_at DESC
    `;
    return mapDatabaseRows(rows, catalogMappers.entityVersion);
  }

  async listEntityVersionsAsOf(workspace: string, asOf: Date, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    const rows = await this.sql<DatabaseRow[]>`
      SELECT v.*, u.display_name AS created_by_name FROM entity_version v
      LEFT JOIN users u ON u.id = v.created_by
      WHERE v.workspace = ${workspace} AND v.created_at <= ${asOf}
      ${entityIds != null ? this.sql`AND v.entity_id = ANY(${entityIds})` : this.sql``}
      ORDER BY v.entity_id, v.created_at ASC
    `;
    return mapDatabaseRows(rows, catalogMappers.entityVersion);
  }

  async updateEntityVersionKind(
    workspace: string,
    versionId: string,
    kind: EntityVersionKind,
    commitMessage: string | null
  ) {
    const [row] = (await this.sql`
      UPDATE entity_version SET kind = ${kind}, commit_message = ${commitMessage}
      WHERE workspace = ${workspace} AND id = ${versionId} RETURNING *
    `) as DatabaseRow[];
    return row ? catalogMappers.entityVersion(row) : null;
  }

  async getEntityVersionById(workspace: string, id: string) {
    const [row] = await this.sql<
      DatabaseRow[]
    >`SELECT v.*, u.display_name AS created_by_name FROM entity_version v LEFT JOIN users u ON u.id = v.created_by WHERE v.workspace = ${workspace} AND v.id = ${id}`;
    return row ? catalogMappers.entityVersion(row) : null;
  }

  async listPlannedEntityChangesAsOf(workspace: string, asOf: Date, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    const rows = await this.sql<DatabaseRow[]>`
      SELECT m.id, c.workspace, m.entity_id,
             c.id AS case_id, r.id AS case_revision_id,
             c.project_id,
             CASE WHEN c.milestone_id IS NULL THEN c.effective_date ELSE NULL END AS target_date,
             c.milestone_id,
             COALESCE(r.message, c.description) AS commit_message,
             r.created_at, r.created_by, u.display_name AS created_by_name,
             m.proposed_state
      FROM entity_change_case_entity_version m
      JOIN entity_change_case_revision r ON r.id = m.revision_id
      JOIN entity_change_case c ON c.id = r.case_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE c.workspace = ${workspace}
        AND r.status IN ('draft', 'submitted', 'changes_requested')
        AND r.created_at <= ${asOf}
        AND (c.milestone_id IS NOT NULL OR c.effective_date IS NULL OR c.effective_date <= ${asOf.toISOString().slice(0, 10)})
        ${entityIds != null ? this.sql`AND m.entity_id = ANY(${entityIds})` : this.sql``}
      ORDER BY m.entity_id, r.created_at ASC
    `;
    return mapDatabaseRows(rows, catalogMappers.plannedEntityChange);
  }

  async listEntityIdsWithVersionHistory(workspace: string, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    const rows = await this.sql<
      { entity_id: string }[]
    >`SELECT DISTINCT entity_id FROM entity_version WHERE workspace = ${workspace} ${entityIds != null ? this.sql`AND entity_id = ANY(${entityIds})` : this.sql``}`;
    return rows.map(row => row.entity_id);
  }

  async listTimelineMarkers(workspace: string) {
    return this.sql<TimelineMarkerDbResult[]>`
      SELECT date, type, COUNT(*)::int AS count FROM (
        SELECT COALESCE(c.effective_date, m.target_date)::text AS date, 'future_update' AS type FROM entity_change_case c LEFT JOIN project_milestone m ON m.id = c.milestone_id WHERE c.workspace = ${workspace} AND c.status = 'planned' AND COALESCE(c.effective_date, m.target_date) IS NOT NULL
        UNION ALL SELECT created_at::date::text AS date, 'saved_version' AS type FROM entity_version WHERE workspace = ${workspace} AND kind = 'saved_version'
        UNION ALL SELECT COALESCE(c.effective_date, m.target_date)::text AS date, 'applied' AS type FROM entity_change_case c LEFT JOIN project_milestone m ON m.id = c.milestone_id WHERE c.workspace = ${workspace} AND c.status = 'applied' AND COALESCE(c.effective_date, m.target_date) IS NOT NULL
      ) markers GROUP BY date, type ORDER BY date ASC
    `;
  }

  async pruneAutosaveVersions(workspace: string, entityId: string, keepCount: number) {
    await this
      .sql`DELETE FROM entity_version WHERE workspace = ${workspace} AND entity_id = ${entityId} AND kind = 'autosave' AND id NOT IN (SELECT id FROM entity_version WHERE workspace = ${workspace} AND entity_id = ${entityId} AND kind = 'autosave' ORDER BY created_at DESC LIMIT ${keepCount})`;
  }

  async reassignSnapshotsFromMilestone(
    workspace: string,
    milestoneId: string,
    backfillTargetDate: string | null
  ) {
    await this
      .sql`UPDATE entity_change_case SET milestone_id = NULL, effective_date = ${backfillTargetDate} WHERE workspace = ${workspace} AND milestone_id = ${milestoneId}`;
  }

  async updateChangeCaseEffectiveDateForMilestone(
    workspace: string,
    milestoneId: string,
    effectiveDate: string | null
  ) {
    await this.sql`
      UPDATE entity_change_case
      SET effective_date = ${effectiveDate}
      WHERE workspace = ${workspace} AND milestone_id = ${milestoneId}
    `;
  }
}

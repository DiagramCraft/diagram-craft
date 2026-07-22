import type {
  CatalogDatabase,
  EntityGrantDbCretae,
  EntityDbCreate,
  EntityListDbFilters,
  EntityListDbPagination,
  WorkspaceEnumDbCreate,
  SchemaDbCreate,
  EntityDbUpdate,
  WorkspaceEnumDbUpdate,
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
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import { isUuidLike } from '../../../utils/publicIds';
import {
  ENTITY_BUILTIN_COLUMNS,
  ENTITY_ARRAY_COLUMNS,
  isValidFieldId,
  escapeLike,
  buildConditionClause
} from './filterBuilder';

const ENTITY_JOINS_SQL = ENTITY_SELECT_SQL;
const ENTITY_JOIN_SQL = `${ENTITY_SELECT_SQL}  WHERE e.deleted_at IS NULL\n`;

export class SqliteCatalogDatabase extends SqliteDatabaseBase implements CatalogDatabase {
  async resolveWorkspaceSlug(slug: string) {
    const row = this.get<{ id: string }>('SELECT id FROM workspace WHERE url_slug = ?', [slug]);
    return row?.id ?? null;
  }

  async listSchemas(workspace: string) {
    return this.all(
      'SELECT * FROM entity_schema WHERE workspace = ? ORDER BY name',
      [workspace],
      catalogMappers.schema
    );
  }

  async getSchema(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM entity_schema WHERE workspace = ? AND id = ?',
      [workspace, id],
      catalogMappers.schema
    );
  }

  async getSchemaByKeyPrefix(prefix: string) {
    return this.get(
      'SELECT * FROM entity_schema WHERE key_prefix = ?',
      [prefix],
      catalogMappers.schema
    );
  }

  async createSchema(input: SchemaDbCreate) {
    this.run(
      'INSERT INTO entity_schema (id, workspace, name, description, fields, templates, color, icon, default_owner, key_prefix, entity_approval_policy, deprecation_policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        JSON.stringify(input.fields),
        JSON.stringify(input.templates ?? []),
        input.color,
        input.icon,
        input.default_owner,
        input.key_prefix,
        input.entity_approval_policy ?? 'disabled',
        input.deprecation_policy ?? 'disabled',
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getSchema(input.workspace, input.id))!;
  }

  async updateSchema(workspace: string, id: string, input: SchemaDbUpdate) {
    this.run(
      'UPDATE entity_schema SET name = ?, description = ?, fields = ?, templates = ?, color = ?, icon = ?, default_owner = ?, key_prefix = ?, entity_approval_policy = COALESCE(?, entity_approval_policy), deprecation_policy = COALESCE(?, deprecation_policy), version = COALESCE(?, version), updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        input.description,
        JSON.stringify(input.fields),
        JSON.stringify(input.templates ?? []),
        input.color,
        input.icon,
        input.default_owner,
        input.key_prefix,
        input.entity_approval_policy ?? 'disabled',
        input.deprecation_policy ?? 'disabled',
        input.version ?? null,
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

  async listSchemaVersions(workspace: string, schemaId: string) {
    return this.all(
      'SELECT * FROM entity_schema_version WHERE workspace = ? AND schema_id = ? ORDER BY version DESC',
      [workspace, schemaId],
      catalogMappers.schemaVersion
    );
  }

  async createSchemaVersion(input: SchemaVersionDbCreate) {
    this.run(
      'INSERT INTO entity_schema_version (id, workspace, schema_id, version, name, description, fields, templates, color, icon, change_summary, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.schema_id,
        input.version,
        input.name,
        input.description,
        JSON.stringify(input.fields),
        JSON.stringify(input.templates),
        input.color,
        input.icon,
        JSON.stringify(input.change_summary),
        input.created_by,
        input.created_at.toISOString()
      ]
    );
    return (await this.get(
      'SELECT * FROM entity_schema_version WHERE workspace = ? AND schema_id = ? AND version = ?',
      [input.workspace, input.schema_id, input.version],
      catalogMappers.schemaVersion
    ))!;
  }

  async renameEntityDataField(
    workspace: string,
    schemaId: string,
    oldFieldId: string,
    newFieldId: string
  ) {
    const result = this.run(
      `UPDATE entity
       SET data = json_set(json_remove(data, '$."' || ? || '"'), '$."' || ? || '"', json_extract(data, '$."' || ? || '"'))
       WHERE workspace = ? AND schema_id = ? AND json_extract(data, '$."' || ? || '"') IS NOT NULL`,
      [oldFieldId, newFieldId, oldFieldId, workspace, schemaId, oldFieldId]
    );
    return result.changes;
  }

  async removeEntityDataField(workspace: string, schemaId: string, fieldId: string) {
    const result = this.run(
      `UPDATE entity
       SET data = json_remove(data, '$."' || ? || '"')
       WHERE workspace = ? AND schema_id = ? AND json_extract(data, '$."' || ? || '"') IS NOT NULL`,
      [fieldId, workspace, schemaId, fieldId]
    );
    return result.changes;
  }

  async listEnums(workspace: string) {
    return this.all(
      'SELECT * FROM workspace_enum WHERE workspace = ? ORDER BY sort_order, name',
      [workspace],
      catalogMappers.workspaceEnum
    );
  }

  async getEnum(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM workspace_enum WHERE workspace = ? AND id = ?',
      [workspace, id],
      catalogMappers.workspaceEnum
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
      `${ENTITY_JOINS_SQL} WHERE e.workspace = ? AND e.deleted_at IS NULL ORDER BY e.name, e.id`,
      [workspace],
      catalogMappers.enrichedEntity
    );
  }

  async listEntitiesPaginated(
    workspace: string,
    filters?: EntityListDbFilters,
    pagination?: EntityListDbPagination
  ) {
    const { limit, offset } = resolveEntityListPagination(pagination);
    const whereParts: string[] = ['e.workspace = ? AND e.deleted_at IS NULL'];
    const params: unknown[] = [workspace];
    const addParam = (v: unknown) => {
      params.push(v);
      return '?';
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
        `(LOWER(e.name) LIKE LOWER(${addParam(pat)}) OR LOWER(e.slug) LIKE LOWER(${addParam(pat)}) OR LOWER(e.description) LIKE LOWER(${addParam(pat)}))`
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
        col = `json_extract(e.data, '$.${cond.fieldId}')`;
      }
      if (!col) continue;
      const clause = buildConditionClause(col, cond, addParam, 'sqlite', kind);
      if (clause) whereParts.push(clause);
    }

    return this.all(
      `${ENTITY_JOINS_SQL} WHERE ${whereParts.join(' AND ')} ORDER BY e.name, e.id LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      catalogMappers.enrichedEntity
    );
  }

  async getEntity(workspace: string, identifier: string) {
    if (!isUuidLike(identifier)) {
      return this.getEntityByPublicId(workspace, identifier);
    }
    return this.get(
      `${ENTITY_JOIN_SQL} AND e.workspace = ? AND e.id = ?`,
      [workspace, identifier],
      catalogMappers.enrichedEntity
    );
  }

  private async getEntityByPublicId(workspace: string, publicId: string) {
    return this.get(
      `${ENTITY_JOIN_SQL} AND e.public_id = ? AND e.workspace = ?`,
      [publicId, workspace],
      catalogMappers.enrichedEntity
    );
  }

  async createEntity(input: EntityDbCreate) {
    this.run(
      'INSERT INTO entity (id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, generated_metadata, visibility_mode, version, approval_policy_override, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        JSON.stringify(input.generated_metadata ?? {}),
        input.visibility_mode,
        input.version ?? 1,
        input.approval_policy_override ?? null,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getEntity(input.workspace, input.id))!;
  }

  async updateEntity(workspace: string, id: string, input: EntityDbUpdate) {
    this.run(
      'UPDATE entity SET slug = ?, namespace = ?, name = ?, description = ?, owner = ?, lifecycle = ?, target_lifecycle = ?, target_lifecycle_date = ?, tags = ?, links = ?, schema_id = ?, data = ?, generated_metadata = COALESCE(?, generated_metadata), visibility_mode = ?, version = version + 1, approval_policy_override = COALESCE(?, approval_policy_override), updated_at = ? WHERE workspace = ? AND id = ?',
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
        input.generated_metadata !== undefined ? JSON.stringify(input.generated_metadata) : null,
        input.visibility_mode,
        input.approval_policy_override ?? null,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getEntity(workspace, id);
  }

  async updateEntityIfVersion(
    workspace: string,
    id: string,
    input: EntityDbUpdate,
    expectedVersion: number
  ) {
    const result = this.run(
      'UPDATE entity SET slug = ?, namespace = ?, name = ?, description = ?, owner = ?, lifecycle = ?, target_lifecycle = ?, target_lifecycle_date = ?, tags = ?, links = ?, schema_id = ?, data = ?, generated_metadata = COALESCE(?, generated_metadata), visibility_mode = ?, version = version + 1, approval_policy_override = COALESCE(?, approval_policy_override), updated_at = ? WHERE workspace = ? AND id = ? AND version = ?',
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
        input.generated_metadata !== undefined ? JSON.stringify(input.generated_metadata) : null,
        input.visibility_mode,
        input.approval_policy_override ?? null,
        input.updated_at.toISOString(),
        workspace,
        id,
        expectedVersion
      ]
    );
    return result.changes === 0 ? null : await this.getEntity(workspace, id);
  }

  async setEntityApprovalPolicyOverride(
    workspace: string,
    id: string,
    override: 'required' | 'disabled' | null
  ) {
    const result = this.run(
      'UPDATE entity SET approval_policy_override = ?, version = version + 1, updated_at = ? WHERE workspace = ? AND id = ?',
      [override, new Date().toISOString(), workspace, id]
    );
    return result.changes === 0 ? null : await this.getEntity(workspace, id);
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
      catalogMappers.entityGrant
    );
  }

  async getEntityGrants(workspace: string, entityId: string) {
    return this.all(
      'SELECT * FROM entity_grant WHERE workspace = ? AND entity_id = ? ORDER BY principal_type, principal_id',
      [workspace, entityId],
      catalogMappers.entityGrant
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
      catalogMappers.pinnedEntity
    );
  }

  async getPinnedEntity(userId: string, workspace: string, entityId: string) {
    return await this.get(
      'SELECT * FROM user_pinned_entity WHERE user_id = ? AND workspace = ? AND entity_id = ?',
      [userId, workspace, entityId],
      catalogMappers.pinnedEntity
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
      catalogMappers.pinnedEntity
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
      'INSERT INTO entity_snapshot (id, workspace, entity_id, status, project_id, target_date, milestone_id, commit_message, created_at, created_by, created_by_name, base_state, proposed_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.entity_id,
        input.status,
        input.project_id,
        input.target_date,
        input.milestone_id,
        input.commit_message,
        input.created_at.toISOString(),
        input.created_by,
        input.created_by_name,
        JSON.stringify(input.base_state),
        input.proposed_state != null ? JSON.stringify(input.proposed_state) : null
      ]
    );
    return (await this.get(
      `${ENTITY_SNAPSHOT_SELECT_SQL}
       WHERE s.id = ?`,
      [input.id],
      catalogMappers.entitySnapshot
    ))!;
  }

  async getSnapshot(workspace: string, snapshotId: string) {
    return await this.get(
      `${ENTITY_SNAPSHOT_SELECT_SQL}
       WHERE s.workspace = ? AND s.id = ?`,
      [workspace, snapshotId],
      catalogMappers.entitySnapshot
    );
  }

  async listSnapshots(workspace: string, entityId: string) {
    return this.all(
      `${ENTITY_SNAPSHOT_SELECT_SQL}
       WHERE s.workspace = ? AND s.entity_id = ?
       ORDER BY s.created_at DESC`,
      [workspace, entityId],
      catalogMappers.entitySnapshot
    );
  }

  async listSnapshotsByProject(workspace: string, projectId: string) {
    return this.all(
      `${ENTITY_SNAPSHOT_SELECT_SQL}
       INNER JOIN project p ON p.id = s.project_id
       WHERE s.workspace = ?
         AND p.workspace = ?
         AND (p.id = ? OR p.public_id = ?)
         AND s.status IN ('future_update', 'applied')
       ORDER BY CASE WHEN s.target_date IS NULL THEN 1 ELSE 0 END, s.target_date ASC, s.created_at DESC`,
      [workspace, workspace, projectId, projectId],
      catalogMappers.entitySnapshot
    );
  }

  async listSnapshotsAsOf(workspace: string, asOf: Date, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    const asOfIso = asOf.toISOString();
    const entityFilter =
      entityIds != null ? `AND s.entity_id IN (${entityIds.map(() => '?').join(',')})` : '';
    return this.all(
      `SELECT s.*, u.display_name as created_by_name
       FROM entity_snapshot s
       LEFT JOIN users u ON u.id = s.created_by
       LEFT JOIN project_milestone m ON m.id = s.milestone_id
       WHERE s.workspace = ?
         AND (
           (s.status IN ('autosave', 'saved_version', 'deleted') AND s.created_at <= ?)
           OR (s.status = 'future_update' AND COALESCE(s.target_date, m.target_date) <= ? AND s.created_at <= ?)
         )
         ${entityFilter}
       ORDER BY s.entity_id, s.created_at ASC`,
      [workspace, asOfIso, asOfIso, asOfIso, ...(entityIds ?? [])],
      catalogMappers.entitySnapshot
    );
  }

  async listEntityIdsWithAnySnapshot(workspace: string, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    // Only 'autosave'/'saved_version'/'deleted' count as "own history" checkpoints — a
    // 'future_update' snapshot alone doesn't give us any real baseline state to reconstruct
    // from, so it must not suppress the live-state fallback.
    const entityFilter =
      entityIds != null ? `AND entity_id IN (${entityIds.map(() => '?').join(',')})` : '';
    return this.all(
      `SELECT DISTINCT entity_id FROM entity_snapshot
       WHERE workspace = ? AND status IN ('autosave', 'saved_version', 'deleted') ${entityFilter}`,
      [workspace, ...(entityIds ?? [])],
      (row: Record<string, unknown>) => String(row['entity_id'])
    );
  }

  async listTimelineMarkers(workspace: string) {
    return this.all(
      `SELECT date, type, COUNT(*) AS count FROM (
         SELECT target_date AS date, 'future_update' AS type
         FROM entity_snapshot
         WHERE workspace = ? AND status = 'future_update' AND target_date IS NOT NULL
         UNION ALL
         SELECT substr(created_at, 1, 10) AS date, 'saved_version' AS type
         FROM entity_snapshot
         WHERE workspace = ? AND status = 'saved_version'
         UNION ALL
         SELECT target_date AS date, 'applied' AS type
         FROM entity_snapshot
         WHERE workspace = ? AND status = 'applied' AND target_date IS NOT NULL
       ) markers
       GROUP BY date, type
       ORDER BY date ASC`,
      [workspace, workspace, workspace],
      (row: Record<string, unknown>): TimelineMarkerDbResult => ({
        date: String(row['date']),
        type: row['type'] as TimelineMarkerDbResult['type'],
        count: Number(row['count'])
      })
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
      catalogMappers.entitySnapshot
    );
    if (existing?.status !== 'autosave') return null;

    this.run(
      `UPDATE entity_snapshot SET status = 'saved_version', commit_message = ? WHERE id = ?`,
      [commitMessage, snapshotId]
    );
    return await this.get(
      `${ENTITY_SNAPSHOT_SELECT_SQL}
       WHERE s.id = ?`,
      [snapshotId],
      catalogMappers.entitySnapshot
    );
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
    const existing = await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ? AND workspace = ?',
      [snapshotId, workspace],
      catalogMappers.entitySnapshot
    );
    if (existing?.status !== 'future_update') return null;

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
    if (updates.milestone_id !== undefined) {
      setClauses.push('milestone_id = ?');
      params.push(updates.milestone_id);
    }
    if (updates.commit_message !== undefined) {
      setClauses.push('commit_message = ?');
      params.push(updates.commit_message);
    }

    if (setClauses.length === 0) return existing;

    params.push(snapshotId);
    this.run(`UPDATE entity_snapshot SET ${setClauses.join(', ')} WHERE id = ?`, params);
    return await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ?',
      [snapshotId],
      catalogMappers.entitySnapshot
    );
  }

  async deleteSnapshot(workspace: string, snapshotId: string) {
    const existing = await this.get(
      'SELECT * FROM entity_snapshot WHERE workspace = ? AND id = ?',
      [workspace, snapshotId],
      catalogMappers.entitySnapshot
    );
    if (existing?.status !== 'future_update') return null;

    this.run('DELETE FROM entity_snapshot WHERE workspace = ? AND id = ?', [workspace, snapshotId]);
    return existing;
  }

  async reassignSnapshotsFromMilestone(
    workspace: string,
    milestoneId: string,
    backfillTargetDate: string | null
  ) {
    this.run(
      'UPDATE entity_snapshot SET milestone_id = NULL, target_date = ? WHERE workspace = ? AND milestone_id = ?',
      [backfillTargetDate, workspace, milestoneId]
    );
  }

  async applySnapshot(workspace: string, snapshotId: string) {
    const existing = await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ? AND workspace = ?',
      [snapshotId, workspace],
      catalogMappers.entitySnapshot
    );
    if (existing?.status !== 'future_update') return null;

    this.run(`UPDATE entity_snapshot SET status = 'applied' WHERE id = ?`, [snapshotId]);
    return await this.get(
      'SELECT * FROM entity_snapshot WHERE id = ?',
      [snapshotId],
      catalogMappers.entitySnapshot
    );
  }
}

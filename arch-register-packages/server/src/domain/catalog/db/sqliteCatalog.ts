import { randomUUID } from 'node:crypto';
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
  EntitySnapshotDbResult,
  EntityVersionDbCreate,
  EntityVersionDbResult,
  EntityVersionKind,
  TimelineMarkerDbResult
} from './catalogDatabase';
import { ENTITY_SELECT_SQL, catalogMappers, resolveEntityListPagination } from './catalogDatabase';
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

  async runCompiledEntityQuery(sql: string, params: unknown[]) {
    return this.all(sql, params, catalogMappers.entityQuery);
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
      'INSERT INTO entity (id, workspace, public_id, slug, namespace, name, description, owner, lifecycle, target_lifecycle, target_lifecycle_date, tags, links, schema_id, data, generated_metadata, project_id, version, approval_policy_override, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        input.project_id,
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
      'UPDATE entity SET slug = ?, namespace = ?, name = ?, description = ?, owner = ?, lifecycle = ?, target_lifecycle = ?, target_lifecycle_date = ?, tags = ?, links = ?, schema_id = ?, data = ?, generated_metadata = COALESCE(?, generated_metadata), project_id = ?, version = version + 1, approval_policy_override = COALESCE(?, approval_policy_override), updated_at = ? WHERE workspace = ? AND id = ?',
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
        input.project_id,
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
      'UPDATE entity SET slug = ?, namespace = ?, name = ?, description = ?, owner = ?, lifecycle = ?, target_lifecycle = ?, target_lifecycle_date = ?, tags = ?, links = ?, schema_id = ?, data = ?, generated_metadata = COALESCE(?, generated_metadata), project_id = ?, version = version + 1, approval_policy_override = COALESCE(?, approval_policy_override), updated_at = ? WHERE workspace = ? AND id = ? AND version = ?',
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
        input.project_id,
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

  async createEntityVersion(input: EntityVersionDbCreate) {
    this.run(
      `INSERT INTO entity_version
       (id, workspace, entity_id, version_number, kind, commit_message, created_at, created_by, state, applied_case_revision_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.entity_id,
        input.version_number,
        input.kind,
        input.commit_message,
        input.created_at.toISOString(),
        input.created_by,
        JSON.stringify(input.state),
        input.applied_case_revision_id
      ]
    );
    return (await this.get(
      `SELECT v.*, u.display_name AS created_by_name
       FROM entity_version v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.id = ?`,
      [input.id],
      catalogMappers.entityVersion
    ))!;
  }

  async listEntityVersions(workspace: string, entityId: string) {
    return this.all(
      `SELECT v.*, u.display_name AS created_by_name
       FROM entity_version v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.workspace = ? AND v.entity_id = ? ORDER BY v.created_at DESC`,
      [workspace, entityId],
      catalogMappers.entityVersion
    );
  }

  async listEntityVersionsAsOf(workspace: string, asOf: Date, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    const filter =
      entityIds != null ? `AND v.entity_id IN (${entityIds.map(() => '?').join(',')})` : '';
    return this.all(
      `SELECT v.*, u.display_name AS created_by_name
       FROM entity_version v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.workspace = ? AND v.created_at <= ? ${filter}
       ORDER BY v.entity_id, v.created_at ASC`,
      [workspace, asOf.toISOString(), ...(entityIds ?? [])],
      catalogMappers.entityVersion
    );
  }

  async updateEntityVersionKind(
    workspace: string,
    versionId: string,
    kind: EntityVersionKind,
    commitMessage: string | null
  ) {
    this.run(
      `UPDATE entity_version SET kind = ?, commit_message = ? WHERE workspace = ? AND id = ?`,
      [kind, commitMessage, workspace, versionId]
    );
    return this.get(
      `SELECT v.*, u.display_name AS created_by_name
       FROM entity_version v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.workspace = ? AND v.id = ?`,
      [workspace, versionId],
      catalogMappers.entityVersion
    );
  }

  private snapshotFromVersion(version: EntityVersionDbResult): EntitySnapshotDbResult {
    return {
      id: version.id,
      workspace: version.workspace,
      entity_id: version.entity_id,
      status:
        version.kind === 'case_applied'
          ? 'applied'
          : version.kind === 'direct_edit' ||
              version.kind === 'restored' ||
              version.kind === 'bypass'
            ? 'autosave'
            : version.kind,
      project_id: null,
      target_date: null,
      milestone_id: null,
      commit_message: version.commit_message,
      created_at: version.created_at,
      created_by: version.created_by ?? '',
      created_by_name: version.created_by_name,
      base_state: version.state,
      proposed_state: null,
      case_revision_id: version.applied_case_revision_id
    };
  }

  private caseSnapshotRows(workspace: string, entityId?: string, projectId?: string) {
    const clauses = [
      'c.workspace = ?',
      "r.status IN ('draft', 'submitted', 'changes_requested', 'applied')"
    ];
    const params: unknown[] = [workspace];
    if (entityId != null) {
      clauses.push('m.entity_id = ?');
      params.push(entityId);
    }
    if (projectId != null) {
      clauses.push('c.project_id = ?');
      params.push(projectId);
    }
    return this.all(
      `SELECT m.id, c.workspace, m.entity_id,
              CASE WHEN r.status = 'applied' THEN 'applied' ELSE 'future_update' END AS status,
              c.id AS case_id, r.id AS case_revision_id,
              c.project_id,
              CASE WHEN c.milestone_id IS NULL THEN c.effective_date ELSE NULL END AS target_date,
              c.milestone_id,
              COALESCE(r.message, c.description) AS commit_message,
              r.created_at, r.created_by, u.display_name AS created_by_name,
              m.base_state, m.proposed_state
       FROM entity_change_case_entity_version m
       JOIN entity_change_case_revision r ON r.id = m.revision_id
       JOIN entity_change_case c ON c.id = r.case_id
       LEFT JOIN users u ON u.id = r.created_by
       WHERE ${clauses.join(' AND ')}
       ORDER BY r.created_at DESC`,
      params,
      catalogMappers.entitySnapshot
    );
  }

  async createSnapshot(input: EntitySnapshotDbCreate) {
    if (input.status === 'future_update' || input.status === 'applied') {
      if (input.target_date != null && input.milestone_id != null) {
        throw new Error('A snapshot cannot specify both target_date and milestone_id');
      }
      const caseId = randomUUID();
      const revisionId = randomUUID();
      this.run(
        `INSERT INTO entity_change_case
         (id, workspace, project_id, status, purpose, name, description, effective_date, milestone_id, initiator_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'planned_change', ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          input.workspace,
          input.project_id,
          input.status === 'applied' ? 'applied' : 'planned',
          input.commit_message,
          input.commit_message,
          input.target_date,
          input.milestone_id,
          input.created_by,
          input.created_at.toISOString(),
          input.created_at.toISOString()
        ]
      );
      if (input.milestone_id != null) {
        this.run(
          `UPDATE entity_change_case
           SET effective_date = (
             SELECT target_date FROM project_milestone
             WHERE id = ? AND project_id = entity_change_case.project_id
           )
           WHERE id = ?`,
          [input.milestone_id, caseId]
        );
      }
      this.run(
        `INSERT INTO entity_change_case_revision
         (id, case_id, workspace, revision_number, message, created_by, status, is_active, created_at, resolved_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        [
          revisionId,
          caseId,
          input.workspace,
          input.commit_message,
          input.created_by,
          input.status === 'applied' ? 'applied' : 'draft',
          input.status === 'applied' ? 0 : 1,
          input.created_at.toISOString(),
          input.status === 'applied' ? input.created_at.toISOString() : null
        ]
      );
      this.run(
        `INSERT INTO entity_change_case_entity_version
         (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          revisionId,
          input.workspace,
          input.entity_id,
          Number(input.base_state['version'] ?? 1),
          JSON.stringify(input.base_state),
          JSON.stringify(input.proposed_state ?? input.base_state),
          JSON.stringify({})
        ]
      );
      return (await this.getSnapshot(input.workspace, input.id))!;
    }
    const state = input.proposed_state ?? input.base_state;
    const existing = this.get<{ max: number | null }>(
      'SELECT MAX(version_number) AS max FROM entity_version WHERE workspace = ? AND entity_id = ?',
      [input.workspace, input.entity_id]
    );
    const versionNumber =
      input.status === 'deleted'
        ? (existing?.max ?? 0) + 1
        : Number(state['version'] ?? (existing?.max ?? 0) + 1);
    await this.createEntityVersion({
      id: input.id,
      workspace: input.workspace,
      entity_id: input.entity_id,
      version_number: versionNumber,
      kind: input.version_kind ?? input.status,
      commit_message: input.commit_message,
      created_at: input.created_at,
      created_by: input.created_by,
      state,
      applied_case_revision_id: input.applied_case_revision_id ?? null
    });
    return (await this.getSnapshot(input.workspace, input.id))!;
  }

  async getSnapshot(workspace: string, snapshotId: string) {
    const version = await this.getEntityVersionById(workspace, snapshotId);
    if (version) return this.snapshotFromVersion(version);
    return this.caseSnapshotRows(workspace).find(row => row.id === snapshotId) ?? null;
  }

  async listSnapshots(workspace: string, entityId: string) {
    const versions = (await this.listEntityVersions(workspace, entityId)).map(v =>
      this.snapshotFromVersion(v)
    );
    const appliedRevisionIds = new Set(
      versions.map(snapshot => snapshot.case_revision_id).filter((id): id is string => id != null)
    );
    const cases = this.caseSnapshotRows(workspace, entityId).filter(
      snapshot =>
        snapshot.status !== 'applied' || !appliedRevisionIds.has(snapshot.case_revision_id ?? '')
    );
    return [...versions, ...cases].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  async listSnapshotsByProject(workspace: string, projectId: string) {
    const project = this.get<{ id: string }>(
      'SELECT id FROM project WHERE workspace = ? AND (id = ? OR public_id = ?)',
      [workspace, projectId, projectId]
    );
    return project ? this.caseSnapshotRows(workspace, undefined, project.id) : [];
  }

  async listSnapshotsAsOf(workspace: string, asOf: Date, entityIds?: string[]) {
    if (entityIds != null && entityIds.length === 0) return [];
    const versions = (await this.listEntityVersionsAsOf(workspace, asOf, entityIds)).map(v =>
      this.snapshotFromVersion(v)
    );
    const cases = this.caseSnapshotRows(workspace).filter(
      s =>
        s.status === 'future_update' &&
        (entityIds == null || entityIds.includes(s.entity_id)) &&
        s.created_at <= asOf &&
        (s.target_date == null || s.target_date <= asOf.toISOString().slice(0, 10))
    );
    return [...versions, ...cases].sort(
      (a, b) =>
        a.entity_id.localeCompare(b.entity_id) || a.created_at.getTime() - b.created_at.getTime()
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
      `SELECT DISTINCT entity_id FROM entity_version WHERE workspace = ? ${entityFilter}`,
      [workspace, ...(entityIds ?? [])],
      (row: Record<string, unknown>) => String(row['entity_id'])
    );
  }

  async listTimelineMarkers(workspace: string) {
    return this.all(
      `SELECT date, type, COUNT(*) AS count FROM (
         SELECT COALESCE(c.effective_date, m.target_date) AS date, 'future_update' AS type
         FROM entity_change_case c
         LEFT JOIN project_milestone m ON m.id = c.milestone_id
         WHERE c.workspace = ? AND c.status = 'planned' AND COALESCE(c.effective_date, m.target_date) IS NOT NULL
         UNION ALL
         SELECT substr(created_at, 1, 10) AS date, 'saved_version' AS type
         FROM entity_version
         WHERE workspace = ? AND kind = 'saved_version'
         UNION ALL
         SELECT COALESCE(c.effective_date, m.target_date) AS date, 'applied' AS type
         FROM entity_change_case c
         LEFT JOIN project_milestone m ON m.id = c.milestone_id
         WHERE c.workspace = ? AND c.status = 'applied' AND COALESCE(c.effective_date, m.target_date) IS NOT NULL
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
      `DELETE FROM entity_version
       WHERE workspace = ? AND entity_id = ? AND kind = 'autosave'
         AND id NOT IN (
           SELECT id FROM entity_version
           WHERE workspace = ? AND entity_id = ? AND kind = 'autosave'
           ORDER BY created_at DESC
           LIMIT ?
         )`,
      [workspace, entityId, workspace, entityId, keepCount]
    );
  }

  async promoteSnapshot(workspace: string, snapshotId: string, commitMessage: string | null) {
    const existing = await this.getEntityVersionById(workspace, snapshotId);
    if (existing?.kind !== 'autosave') return null;
    const updated = await this.updateEntityVersionKind(
      workspace,
      snapshotId,
      'saved_version',
      commitMessage
    );
    return updated ? this.snapshotFromVersion(updated) : null;
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
    const existing = await this.getSnapshot(workspace, snapshotId);
    if (existing?.status !== 'future_update') return null;

    if (existing == null || existing.status !== 'future_update') return null;
    const member = this.get<{ revision_id: string; case_id: string }>(
      `SELECT m.revision_id, r.case_id FROM entity_change_case_entity_version m JOIN entity_change_case_revision r ON r.id = m.revision_id WHERE m.id = ? AND m.workspace = ?`,
      [snapshotId, workspace]
    );
    if (!member) return null;
    if (updates.proposed_state !== undefined)
      this.run('UPDATE entity_change_case_entity_version SET proposed_state = ? WHERE id = ?', [
        JSON.stringify(updates.proposed_state),
        snapshotId
      ]);
    if (updates.target_date !== undefined || updates.milestone_id !== undefined)
      this.run(
        `UPDATE entity_change_case
         SET effective_date = CASE
               WHEN ? IS NULL THEN ?
               ELSE (
                 SELECT target_date FROM project_milestone
                 WHERE id = ? AND project_id = entity_change_case.project_id
               )
             END,
             milestone_id = ?
         WHERE id = ?`,
        [
          updates.milestone_id ?? null,
          updates.target_date ?? null,
          updates.milestone_id ?? null,
          updates.milestone_id ?? null,
          member.case_id
        ]
      );
    if (updates.commit_message !== undefined)
      this.run('UPDATE entity_change_case_revision SET message = ? WHERE id = ?', [
        updates.commit_message,
        member.revision_id
      ]);
    return this.getSnapshot(workspace, snapshotId);
  }

  async deleteSnapshot(workspace: string, snapshotId: string) {
    const existing = await this.getSnapshot(workspace, snapshotId);
    if (existing?.status !== 'future_update') return null;

    this.run(
      `DELETE FROM entity_change_case WHERE id = (SELECT r.case_id FROM entity_change_case_entity_version m JOIN entity_change_case_revision r ON r.id = m.revision_id WHERE m.workspace = ? AND m.id = ?)`,
      [workspace, snapshotId]
    );
    return existing;
  }

  async reassignSnapshotsFromMilestone(
    workspace: string,
    milestoneId: string,
    backfillTargetDate: string | null
  ) {
    this.run(
      'UPDATE entity_change_case SET milestone_id = NULL, effective_date = ? WHERE workspace = ? AND milestone_id = ?',
      [backfillTargetDate, workspace, milestoneId]
    );
  }

  async updateChangeCaseEffectiveDateForMilestone(
    workspace: string,
    milestoneId: string,
    effectiveDate: string | null
  ) {
    this.run(
      'UPDATE entity_change_case SET effective_date = ? WHERE workspace = ? AND milestone_id = ?',
      [effectiveDate, workspace, milestoneId]
    );
  }

  async applySnapshot(workspace: string, snapshotId: string) {
    const existing = await this.getSnapshot(workspace, snapshotId);
    if (existing?.status !== 'future_update') return null;

    const member = this.get<{ revision_id: string; case_id: string }>(
      `SELECT m.revision_id, r.case_id FROM entity_change_case_entity_version m JOIN entity_change_case_revision r ON r.id = m.revision_id WHERE m.id = ? AND m.workspace = ?`,
      [snapshotId, workspace]
    );
    if (!member) return null;
    this.run(
      `UPDATE entity_change_case_revision SET status = 'applied', is_active = 0, resolved_at = ? WHERE id = ?`,
      [new Date().toISOString(), member.revision_id]
    );
    this.run(
      `UPDATE entity_change_case SET status = 'applied', closed_at = ?, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), new Date().toISOString(), member.case_id]
    );
    return this.getSnapshot(workspace, snapshotId);
  }

  private getEntityVersionById(workspace: string, id: string) {
    return this.get(
      `SELECT v.*, u.display_name AS created_by_name FROM entity_version v LEFT JOIN users u ON u.id = v.created_by WHERE v.workspace = ? AND v.id = ?`,
      [workspace, id],
      catalogMappers.entityVersion
    );
  }
}

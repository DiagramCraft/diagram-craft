import type {
  RelationDatabase,
  RelationDbCreate,
  RelationDbUpdate,
  RelationListDbFilters,
  RelationListDbPagination,
  RelationSchemaDbCreate,
  RelationSchemaDbUpdate,
  RelationSchemaVersionDbCreate
} from './relationDatabase';
import { RELATION_SELECT_SQL, relationMappers } from './relationDatabase';
import { resolveEntityListPagination } from './catalogDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteRelationDatabase extends SqliteDatabaseBase implements RelationDatabase {
  async listRelationSchemas(workspace: string) {
    return this.all(
      'SELECT * FROM relation_schema WHERE workspace = ? ORDER BY name',
      [workspace],
      relationMappers.relationSchema
    );
  }

  async getRelationSchema(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM relation_schema WHERE workspace = ? AND id = ?',
      [workspace, id],
      relationMappers.relationSchema
    );
  }

  async createRelationSchema(input: RelationSchemaDbCreate) {
    this.run(
      'INSERT INTO relation_schema (id, workspace, name, category_id, description, in_schema_ids, out_schema_ids, in_label, out_label, fields, groups, shared_field_group_links, validation_rules, color, icon, relation_approval_policy, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.category_id ?? null,
        input.description,
        JSON.stringify(input.in_schema_ids),
        JSON.stringify(input.out_schema_ids),
        input.in_label ?? null,
        input.out_label ?? null,
        JSON.stringify(input.fields),
        JSON.stringify(input.groups ?? []),
        JSON.stringify(input.shared_field_group_links ?? []),
        JSON.stringify(input.validation_rules ?? []),
        input.color,
        input.icon,
        input.relation_approval_policy ?? 'disabled',
        input.version ?? 1,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getRelationSchema(input.workspace, input.id))!;
  }

  async updateRelationSchema(workspace: string, id: string, input: RelationSchemaDbUpdate) {
    this.run(
      'UPDATE relation_schema SET name = ?, category_id = CASE WHEN ? THEN category_id ELSE ? END, description = ?, in_schema_ids = ?, out_schema_ids = ?, in_label = ?, out_label = ?, fields = ?, groups = ?, shared_field_group_links = ?, validation_rules = ?, color = ?, icon = ?, relation_approval_policy = COALESCE(?, relation_approval_policy), version = COALESCE(?, version), updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        input.category_id === undefined ? 1 : 0,
        input.category_id ?? null,
        input.description,
        JSON.stringify(input.in_schema_ids),
        JSON.stringify(input.out_schema_ids),
        input.in_label ?? null,
        input.out_label ?? null,
        JSON.stringify(input.fields),
        JSON.stringify(input.groups ?? []),
        JSON.stringify(input.shared_field_group_links ?? []),
        JSON.stringify(input.validation_rules ?? []),
        input.color,
        input.icon,
        input.relation_approval_policy ?? null,
        input.version ?? null,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getRelationSchema(workspace, id);
  }

  async deleteRelationSchema(workspace: string, id: string) {
    const row = await this.getRelationSchema(workspace, id);
    if (!row) return null;
    this.run('DELETE FROM relation_schema WHERE workspace = ? AND id = ?', [workspace, id]);
    return row;
  }

  async listRelationSchemaVersions(workspace: string, schemaId: string) {
    return this.all(
      'SELECT * FROM relation_schema_version WHERE workspace = ? AND schema_id = ? ORDER BY version DESC',
      [workspace, schemaId],
      relationMappers.relationSchemaVersion
    );
  }

  async createRelationSchemaVersion(input: RelationSchemaVersionDbCreate) {
    this.run(
      'INSERT INTO relation_schema_version (id, workspace, schema_id, version, name, category, description, in_schema_ids, out_schema_ids, in_label, out_label, fields, groups, validation_rules, color, icon, change_summary, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.schema_id,
        input.version,
        input.name,
        input.category ?? null,
        input.description,
        JSON.stringify(input.in_schema_ids),
        JSON.stringify(input.out_schema_ids),
        input.in_label ?? null,
        input.out_label ?? null,
        JSON.stringify(input.fields),
        JSON.stringify(input.groups),
        JSON.stringify(input.validation_rules ?? []),
        input.color,
        input.icon,
        JSON.stringify(input.change_summary),
        input.created_by,
        input.created_at.toISOString()
      ]
    );
    return (await this.get(
      'SELECT * FROM relation_schema_version WHERE workspace = ? AND schema_id = ? AND version = ?',
      [input.workspace, input.schema_id, input.version],
      relationMappers.relationSchemaVersion
    ))!;
  }

  async renameRelationDataField(
    workspace: string,
    schemaId: string,
    oldFieldId: string,
    newFieldId: string
  ) {
    const result = this.run(
      `UPDATE catalog_record
       SET data = json_set(json_remove(data, '$."' || ? || '"'), '$."' || ? || '"', json_extract(data, '$."' || ? || '"'))
       WHERE kind = 'relation' AND workspace = ? AND schema_id = ? AND json_extract(data, '$."' || ? || '"') IS NOT NULL`,
      [oldFieldId, newFieldId, oldFieldId, workspace, schemaId, oldFieldId]
    );
    return result.changes;
  }

  async removeRelationDataField(workspace: string, schemaId: string, fieldId: string) {
    const result = this.run(
      `UPDATE catalog_record
       SET data = json_remove(data, '$."' || ? || '"')
       WHERE kind = 'relation' AND workspace = ? AND schema_id = ? AND json_extract(data, '$."' || ? || '"') IS NOT NULL`,
      [fieldId, workspace, schemaId, fieldId]
    );
    return result.changes;
  }

  async countRelationsForSchema(workspace: string, schemaId: string) {
    const row = this.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM catalog_record WHERE kind = 'relation' AND deleted_at IS NULL AND workspace = ? AND schema_id = ?",
      [workspace, schemaId]
    );
    return Number(row?.count ?? 0);
  }

  async runCompiledRelationQuery(sql: string, params: unknown[]) {
    return this.all(sql, params, relationMappers.relationQuery);
  }

  async runCompiledRelationCountQuery(sql: string, params: unknown[]) {
    const row = this.get<{ count: number }>(sql, params);
    return Number(row?.count ?? 0);
  }

  async listRelations(
    workspace: string,
    filters: RelationListDbFilters,
    pagination: RelationListDbPagination
  ) {
    const { limit, offset } = resolveEntityListPagination(pagination);
    const whereParts: string[] = ['r.workspace = ?'];
    const params: unknown[] = [workspace];
    if (filters.schemaId) {
      whereParts.push('r.schema_id = ?');
      params.push(filters.schemaId);
    }
    if (filters.inEntityId) {
      whereParts.push('r.in_record_id = ?');
      params.push(filters.inEntityId);
    }
    if (filters.outEntityId) {
      whereParts.push('r.out_record_id = ?');
      params.push(filters.outEntityId);
    }
    const where = whereParts.join(' AND ');

    const countRow = this.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM catalog_record r WHERE r.kind = 'relation' AND r.deleted_at IS NULL AND ${where}`,
      params
    );
    const rows = this.all(
      `${RELATION_SELECT_SQL} WHERE ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      relationMappers.relation
    );
    return { items: rows, total: Number(countRow?.count ?? 0) };
  }

  async getRelation(workspace: string, id: string) {
    // RELATION_SELECT_SQL's join already restricts r.kind = 'relation'.
    return this.get(
      `${RELATION_SELECT_SQL} WHERE r.workspace = ? AND r.id = ?`,
      [workspace, id],
      relationMappers.relation
    );
  }

  async createRelation(input: RelationDbCreate) {
    this.run(
      "INSERT INTO catalog_record (id, workspace, kind, schema_id, in_record_id, out_record_id, data, owner, lifecycle, version, approval_policy_override, created_at, updated_at) VALUES (?, ?, 'relation', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        input.id,
        input.workspace,
        input.schema_id,
        input.in_entity_id,
        input.out_entity_id,
        JSON.stringify(input.data),
        input.owner ?? null,
        input.lifecycle ?? null,
        input.version ?? 1,
        input.approval_policy_override ?? null,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getRelation(input.workspace, input.id))!;
  }

  async updateRelation(workspace: string, id: string, input: RelationDbUpdate) {
    // undefined = leave unchanged, so owner/lifecycle/approval_policy_override are only added
    // to the SET clause when the caller actually supplied a value (including explicit null).
    const setClauses = ['data = ?', 'version = ?'];
    const params: unknown[] = [JSON.stringify(input.data), input.version];

    if (input.owner !== undefined) {
      setClauses.push('owner = ?');
      params.push(input.owner);
    }
    if (input.lifecycle !== undefined) {
      setClauses.push('lifecycle = ?');
      params.push(input.lifecycle);
    }
    if (input.approval_policy_override !== undefined) {
      setClauses.push('approval_policy_override = ?');
      params.push(input.approval_policy_override);
    }
    setClauses.push('updated_at = ?');
    params.push(input.updated_at.toISOString());

    this.run(
      `UPDATE catalog_record SET ${setClauses.join(', ')} WHERE workspace = ? AND id = ? AND kind = 'relation'`,
      [...params, workspace, id]
    );
    return await this.getRelation(workspace, id);
  }

  async updateRelationDerivedFields(workspace: string, id: string, data: Record<string, unknown>) {
    this.run(
      "UPDATE catalog_record SET data = ? WHERE workspace = ? AND id = ? AND kind = 'relation'",
      [JSON.stringify(data), workspace, id]
    );
  }

  async deleteRelation(workspace: string, id: string) {
    const existing = await this.getRelation(workspace, id);
    if (!existing) return null;
    this.run(
      "UPDATE catalog_record SET deleted_at = ? WHERE workspace = ? AND id = ? AND kind = 'relation'",
      [new Date().toISOString(), workspace, id]
    );
    return existing;
  }

  async listRelationsForEntity(workspace: string, entityId: string) {
    const outgoing = this.all(
      `${RELATION_SELECT_SQL} WHERE r.workspace = ? AND r.in_record_id = ? ORDER BY r.created_at DESC, r.id DESC`,
      [workspace, entityId],
      relationMappers.relation
    );
    const incoming = this.all(
      `${RELATION_SELECT_SQL} WHERE r.workspace = ? AND r.out_record_id = ? ORDER BY r.created_at DESC, r.id DESC`,
      [workspace, entityId],
      relationMappers.relation
    );
    return { outgoing, incoming };
  }

  async listRelationsForEntities(workspace: string, entityIds: string[]) {
    if (entityIds.length === 0) return { outgoing: [], incoming: [] };
    const placeholders = entityIds.map(() => '?').join(',');
    const outgoing = this.all(
      `${RELATION_SELECT_SQL} WHERE r.workspace = ? AND r.in_record_id IN (${placeholders}) ORDER BY r.created_at DESC, r.id DESC`,
      [workspace, ...entityIds],
      relationMappers.relation
    );
    const incoming = this.all(
      `${RELATION_SELECT_SQL} WHERE r.workspace = ? AND r.out_record_id IN (${placeholders}) ORDER BY r.created_at DESC, r.id DESC`,
      [workspace, ...entityIds],
      relationMappers.relation
    );
    return { outgoing, incoming };
  }
}

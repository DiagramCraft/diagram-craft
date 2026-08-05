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
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';

export class PostgresRelationDatabase extends PostgresDatabaseBase implements RelationDatabase {
  async listRelationSchemas(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM relation_schema WHERE workspace = ${workspace} ORDER BY name
    `;
    return mapDatabaseRows(rows, relationMappers.relationSchema);
  }

  async getRelationSchema(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM relation_schema WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? relationMappers.relationSchema(row) : null;
  }

  async createRelationSchema(input: RelationSchemaDbCreate) {
    try {
      const rows = (await this.sql`
        INSERT INTO relation_schema
          (id, workspace, name, description, in_schema_ids, out_schema_ids, fields, groups, shared_field_group_links, color, icon, relation_approval_policy, version, created_at, updated_at)
        VALUES
          (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${this.json(input.in_schema_ids)}, ${this.json(input.out_schema_ids)}, ${this.json(input.fields)}, ${this.json(input.groups ?? [])}, ${this.json(input.shared_field_group_links ?? [])}, ${input.color}, ${input.icon}, ${input.relation_approval_policy ?? 'disabled'}, ${input.version ?? 1}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `) as DatabaseRow[];
      const [row] = rows;
      return relationMappers.relationSchema(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateRelationSchema(workspace: string, id: string, input: RelationSchemaDbUpdate) {
    try {
      const rows = (await this.sql`
        UPDATE relation_schema
        SET name = ${input.name},
            description = ${input.description},
            in_schema_ids = ${this.json(input.in_schema_ids)},
            out_schema_ids = ${this.json(input.out_schema_ids)},
            fields = ${this.json(input.fields)},
            groups = ${this.json(input.groups ?? [])},
            shared_field_group_links = ${this.json(input.shared_field_group_links ?? [])},
            color = ${input.color},
            icon = ${input.icon},
            relation_approval_policy = COALESCE(${input.relation_approval_policy ?? null}, relation_approval_policy),
            version = COALESCE(${input.version ?? null}::integer, version),
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `) as DatabaseRow[];
      const [row] = rows;
      return row ? relationMappers.relationSchema(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteRelationSchema(workspace: string, id: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM relation_schema
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? relationMappers.relationSchema(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listRelationSchemaVersions(workspace: string, schemaId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM relation_schema_version
      WHERE workspace = ${workspace} AND schema_id = ${schemaId}
      ORDER BY version DESC
    `;
    return mapDatabaseRows(rows, relationMappers.relationSchemaVersion);
  }

  async createRelationSchemaVersion(input: RelationSchemaVersionDbCreate) {
    const [row] = (await this.sql`
      INSERT INTO relation_schema_version
        (id, workspace, schema_id, version, name, description, in_schema_ids, out_schema_ids, fields, groups, color, icon, change_summary, created_by, created_at)
      VALUES
        (${input.id}, ${input.workspace}, ${input.schema_id}, ${input.version}, ${input.name}, ${input.description}, ${this.json(input.in_schema_ids)}, ${this.json(input.out_schema_ids)}, ${this.json(input.fields)}, ${this.json(input.groups)}, ${input.color}, ${input.icon}, ${this.json(input.change_summary)}, ${input.created_by}, ${input.created_at})
      RETURNING *
    `) as DatabaseRow[];
    return relationMappers.relationSchemaVersion(row!);
  }

  async renameRelationDataField(
    workspace: string,
    schemaId: string,
    oldFieldId: string,
    newFieldId: string
  ) {
    const rows = (await this.sql`
      UPDATE catalog_record
      SET data = (data - ${oldFieldId}::text)
        || jsonb_build_object(${newFieldId}::text, data -> ${oldFieldId}::text)
      WHERE kind = 'relation' AND workspace = ${workspace} AND schema_id = ${schemaId} AND data ? ${oldFieldId}::text
      RETURNING id
    `) as DatabaseRow[];
    return rows.length;
  }

  async removeRelationDataField(workspace: string, schemaId: string, fieldId: string) {
    const rows = (await this.sql`
      UPDATE catalog_record
      SET data = data - ${fieldId}::text
      WHERE kind = 'relation' AND workspace = ${workspace} AND schema_id = ${schemaId} AND data ? ${fieldId}::text
      RETURNING id
    `) as DatabaseRow[];
    return rows.length;
  }

  async countRelationsForSchema(workspace: string, schemaId: string) {
    const [row] = await this.sql<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM catalog_record WHERE kind = 'relation' AND deleted_at IS NULL AND workspace = ${workspace} AND schema_id = ${schemaId}
    `;
    return Number(row?.count ?? 0);
  }

  async runCompiledRelationQuery(sql: string, params: unknown[]) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      sql,
      params as Parameters<typeof this.sql.unsafe>[1]
    );
    return mapDatabaseRows(rows, relationMappers.relationQuery);
  }

  async runCompiledRelationCountQuery(sql: string, params: unknown[]) {
    const [row] = await this.sql.unsafe<{ count: string }[]>(
      sql,
      params as Parameters<typeof this.sql.unsafe>[1]
    );
    return Number(row?.count ?? 0);
  }

  async listRelations(
    workspace: string,
    filters: RelationListDbFilters,
    pagination: RelationListDbPagination
  ) {
    const { limit, offset } = resolveEntityListPagination(pagination);
    const whereParts: string[] = ['r.workspace = $1'];
    const params: unknown[] = [workspace];
    const addParam = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (filters.schemaId) whereParts.push(`r.schema_id = ${addParam(filters.schemaId)}`);
    if (filters.inEntityId) whereParts.push(`r.in_record_id = ${addParam(filters.inEntityId)}`);
    if (filters.outEntityId) whereParts.push(`r.out_record_id = ${addParam(filters.outEntityId)}`);
    const where = whereParts.join(' AND ');

    const [countRow] = await this.sql.unsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM catalog_record r WHERE r.kind = 'relation' AND r.deleted_at IS NULL AND ${where}`,
      params as Parameters<typeof this.sql.unsafe>[1]
    );

    const limitParam = addParam(limit);
    const offsetParam = addParam(offset);
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${RELATION_SELECT_SQL} WHERE ${where} ORDER BY r.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params as Parameters<typeof this.sql.unsafe>[1]
    );
    return {
      items: mapDatabaseRows(rows, relationMappers.relation),
      total: Number(countRow?.count ?? 0)
    };
  }

  async getRelation(workspace: string, id: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${RELATION_SELECT_SQL} WHERE r.workspace = $1 AND r.id = $2`,
      [workspace, id]
    );
    return rows[0] ? relationMappers.relation(rows[0]) : null;
  }

  async createRelation(input: RelationDbCreate) {
    try {
      await this.sql`
        INSERT INTO catalog_record (id, workspace, kind, schema_id, in_record_id, out_record_id, data, owner, lifecycle, version, approval_policy_override, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, 'relation', ${input.schema_id}, ${input.in_entity_id}, ${input.out_entity_id}, ${this.json(input.data)}, ${input.owner ?? null}, ${input.lifecycle ?? null}, ${input.version ?? 1}, ${input.approval_policy_override ?? null}, ${input.created_at}, ${input.updated_at})
      `;
      return (await this.getRelation(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateRelation(workspace: string, id: string, input: RelationDbUpdate) {
    try {
      // undefined = leave unchanged, so owner/lifecycle/approval_policy_override are only
      // added to the SET clause when the caller actually supplied a value (including explicit
      // null) — mirrors sqliteRelation.ts's updateRelation.
      const setClauses = ['data = $1::jsonb', 'version = $2'];
      const params: unknown[] = [JSON.stringify(input.data), input.version];

      if (input.owner !== undefined) {
        params.push(input.owner);
        setClauses.push(`owner = $${params.length}`);
      }
      if (input.lifecycle !== undefined) {
        params.push(input.lifecycle);
        setClauses.push(`lifecycle = $${params.length}`);
      }
      if (input.approval_policy_override !== undefined) {
        params.push(input.approval_policy_override);
        setClauses.push(`approval_policy_override = $${params.length}`);
      }
      params.push(input.updated_at);
      setClauses.push(`updated_at = $${params.length}`);
      params.push(workspace);
      const workspaceIdx = params.length;
      params.push(id);
      const idIdx = params.length;

      const rows = await this.sql.unsafe<DatabaseRow[]>(
        `UPDATE catalog_record SET ${setClauses.join(', ')} WHERE workspace = $${workspaceIdx} AND id = $${idIdx} AND kind = 'relation' RETURNING id`,
        params as Parameters<typeof this.sql.unsafe>[1]
      );
      if (!rows[0]) return null;
      return await this.getRelation(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteRelation(workspace: string, id: string) {
    const existing = await this.getRelation(workspace, id);
    if (!existing) return null;
    await this
      .sql`UPDATE catalog_record SET deleted_at = NOW() WHERE workspace = ${workspace} AND id = ${id} AND kind = 'relation'`;
    return existing;
  }

  async listRelationsForEntity(workspace: string, entityId: string) {
    const outgoingRows = await this.sql.unsafe<DatabaseRow[]>(
      `${RELATION_SELECT_SQL} WHERE r.workspace = $1 AND r.in_record_id = $2 ORDER BY r.created_at DESC`,
      [workspace, entityId]
    );
    const incomingRows = await this.sql.unsafe<DatabaseRow[]>(
      `${RELATION_SELECT_SQL} WHERE r.workspace = $1 AND r.out_record_id = $2 ORDER BY r.created_at DESC`,
      [workspace, entityId]
    );
    return {
      outgoing: mapDatabaseRows(outgoingRows, relationMappers.relation),
      incoming: mapDatabaseRows(incomingRows, relationMappers.relation)
    };
  }

  async listRelationsForEntities(workspace: string, entityIds: string[]) {
    if (entityIds.length === 0) return { outgoing: [], incoming: [] };
    const placeholders = entityIds.map((_, i) => `$${i + 2}`).join(',');
    const params = [workspace, ...entityIds] as Parameters<typeof this.sql.unsafe>[1];
    const outgoingRows = await this.sql.unsafe<DatabaseRow[]>(
      `${RELATION_SELECT_SQL} WHERE r.workspace = $1 AND r.in_record_id IN (${placeholders}) ORDER BY r.created_at DESC`,
      params
    );
    const incomingRows = await this.sql.unsafe<DatabaseRow[]>(
      `${RELATION_SELECT_SQL} WHERE r.workspace = $1 AND r.out_record_id IN (${placeholders}) ORDER BY r.created_at DESC`,
      params
    );
    return {
      outgoing: mapDatabaseRows(outgoingRows, relationMappers.relation),
      incoming: mapDatabaseRows(incomingRows, relationMappers.relation)
    };
  }
}

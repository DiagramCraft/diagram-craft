import type { DatabaseRow } from '../../../db/rowMappers';
import {
  databaseBoolean,
  databaseDate,
  mapDatabaseRows,
  mapDatabaseRow,
  parseDatabaseJson
} from '../../../db/rowMappers';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import type {
  DocumentDatabase,
  DocumentMetadataDbUpsert,
  DocumentTemplateDbCreate,
  DocumentTemplateDbResult,
  DocumentTypeDbCreate,
  DocumentTypeDbResult,
  DocumentTypeVersionDbCreate,
  DocumentTypeVersionDbResult
} from './documentDatabase';
import type {
  DocumentTemplateWrite,
  DocumentTypeWrite
} from '@arch-register/api-types/documentContract';

const typeMapper = (row: DatabaseRow): DocumentTypeDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  name: String(row['name']),
  description: String(row['description'] ?? ''),
  fields: parseDatabaseJson(row['fields'], [], 'document_type.fields'),
  color: row['color'] == null ? null : String(row['color']),
  icon: row['icon'] == null ? null : String(row['icon']),
  archived: databaseBoolean(row['archived']),
  version: Number(row['version'] ?? 1),
  aiActions: parseDatabaseJson(row['ai_actions'], [], 'document_type.ai_actions'),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at'])
});
const typeVersionMapper = (row: DatabaseRow): DocumentTypeVersionDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  document_type_id: String(row['document_type_id']),
  version: Number(row['version']),
  name: String(row['name']),
  description: String(row['description'] ?? ''),
  fields: parseDatabaseJson(row['fields'], [], 'document_type_version.fields'),
  color: row['color'] == null ? null : String(row['color']),
  icon: row['icon'] == null ? null : String(row['icon']),
  change_summary: parseDatabaseJson(
    row['change_summary'],
    {},
    'document_type_version.change_summary'
  ),
  created_by: row['created_by'] == null ? null : String(row['created_by']),
  created_at: databaseDate(row['created_at'])
});
const templateMapper = (row: DatabaseRow): DocumentTemplateDbResult => {
  if (row['document_type_id'] == null)
    throw new Error('Document template is missing a document type');
  return {
    id: String(row['id']),
    workspace: String(row['workspace']),
    project_id: row['project_id'] == null ? null : String(row['project_id']),
    name: String(row['name']),
    body: String(row['body']),
    document_type_id: String(row['document_type_id']),
    metadata_defaults: parseDatabaseJson(
      row['metadata_defaults'],
      {},
      'document_template.metadata_defaults'
    ),
    archived: databaseBoolean(row['archived']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  };
};
const metadataMapper = (row: DatabaseRow) => ({
  workspace: String(row['workspace']),
  node_id: String(row['node_id']),
  document_type_id: row['document_type_id'] == null ? null : String(row['document_type_id']),
  values: parseDatabaseJson(row['values'], {}, 'content_node_document.values'),
  updated_at: databaseDate(row['updated_at'])
});
const linkMapper = (row: DatabaseRow) => ({
  workspace: String(row['workspace']),
  node_id: String(row['node_id']),
  field_id: String(row['field_id']),
  target_type: String(row['target_type']) as 'entity' | 'document',
  target_id: String(row['target_id']),
  position: Number(row['position'])
});

export class PostgresDocumentDatabase extends PostgresDatabaseBase implements DocumentDatabase {
  private async syncDocumentFields(
    workspace: string,
    documentTypeId: string,
    fields: DocumentTypeWrite['fields'],
    timestamp: Date
  ) {
    const existing = await this.sql<
      { id: string }[]
    >`SELECT id FROM document_field WHERE workspace = ${workspace} AND document_type_id = ${documentTypeId}`;
    const remaining = new Set(existing.map(row => row.id));
    for (const field of fields) {
      await this.sql`
        INSERT INTO document_field (id, workspace, document_type_id, name, type, requirement, min_cardinality, max_cardinality, enum_options, inverse_name, retired, created_at, updated_at)
        VALUES (${field.id}, ${workspace}, ${documentTypeId}, ${field.name}, ${field.type}, ${field.requirement}, ${field.minCardinality ?? null}, ${field.maxCardinality ?? null}, ${this.json(field.enumOptions ?? [])}, ${field.inverseName ?? null}, ${field.retired ?? false}, ${timestamp}, ${timestamp})
        ON CONFLICT (workspace, document_type_id, id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, requirement = EXCLUDED.requirement, min_cardinality = EXCLUDED.min_cardinality, max_cardinality = EXCLUDED.max_cardinality, enum_options = EXCLUDED.enum_options, inverse_name = EXCLUDED.inverse_name, retired = EXCLUDED.retired, updated_at = EXCLUDED.updated_at`;
      remaining.delete(field.id);
    }
    for (const fieldId of remaining) {
      await this
        .sql`DELETE FROM document_field WHERE workspace = ${workspace} AND document_type_id = ${documentTypeId} AND id = ${fieldId}`;
    }
  }

  async listDocumentTypes(workspace: string, includeArchived = false) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `SELECT * FROM document_type WHERE workspace = $1 ${includeArchived ? '' : 'AND archived = FALSE'} ORDER BY name`,
      [workspace]
    );
    return mapDatabaseRows(rows, typeMapper);
  }
  async getDocumentType(workspace: string, id: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      'SELECT * FROM document_type WHERE workspace = $1 AND id = $2',
      [workspace, id]
    );
    return mapDatabaseRow(rows[0], typeMapper);
  }
  async createDocumentType(input: DocumentTypeDbCreate) {
    try {
      await this
        .sql`INSERT INTO document_type (id, workspace, name, description, fields, color, icon, ai_actions, archived, created_at, updated_at) VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${this.json(input.fields)}, ${input.color ?? null}, ${input.icon ?? null}, ${this.json(input.aiActions ?? [])}, FALSE, ${input.created_at}, ${input.updated_at})`;
      await this.syncDocumentFields(input.workspace, input.id, input.fields, input.updated_at);
      return (await this.getDocumentType(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
  async updateDocumentType(
    workspace: string,
    id: string,
    input: DocumentTypeWrite & { updated_at: Date; version?: number }
  ) {
    try {
      await this
        .sql`UPDATE document_type SET name = ${input.name}, description = ${input.description}, fields = ${this.json(input.fields)}, color = ${input.color ?? null}, icon = ${input.icon ?? null}, ai_actions = ${this.json(input.aiActions ?? [])}, version = COALESCE(${input.version ?? null}::integer, version), updated_at = ${input.updated_at} WHERE workspace = ${workspace} AND id = ${id}`;
      await this.syncDocumentFields(workspace, id, input.fields, input.updated_at);
      return await this.getDocumentType(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
  async archiveDocumentType(workspace: string, id: string, archived: boolean, updated_at: Date) {
    try {
      await this
        .sql`UPDATE document_type SET archived = ${archived}, updated_at = ${updated_at} WHERE workspace = ${workspace} AND id = ${id}`;
      return await this.getDocumentType(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
  async deleteDocumentType(workspace: string, id: string) {
    try {
      await this.sql`DELETE FROM document_type WHERE workspace = ${workspace} AND id = ${id}`;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
  async listDocumentTypeVersions(workspace: string, documentTypeId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM document_type_version
      WHERE workspace = ${workspace} AND document_type_id = ${documentTypeId}
      ORDER BY version DESC
    `;
    return mapDatabaseRows(rows, typeVersionMapper);
  }
  async createDocumentTypeVersion(input: DocumentTypeVersionDbCreate) {
    const [row] = (await this.sql`
      INSERT INTO document_type_version
        (id, workspace, document_type_id, version, name, description, fields, color, icon, change_summary, created_by, created_at)
      VALUES
        (${input.id}, ${input.workspace}, ${input.document_type_id}, ${input.version}, ${input.name}, ${input.description}, ${this.json(input.fields)}, ${input.color}, ${input.icon}, ${this.json(input.change_summary)}, ${input.created_by}, ${input.created_at})
      RETURNING *
    `) as DatabaseRow[];
    return typeVersionMapper(row!);
  }
  async renameDocumentMetadataField(
    workspace: string,
    documentTypeId: string,
    oldFieldId: string,
    newFieldId: string
  ) {
    const rows = (await this.sql`
      UPDATE content_node_document
      SET "values" = ("values" - ${oldFieldId}::text)
        || jsonb_build_object(${newFieldId}::text, "values" -> ${oldFieldId}::text)
      WHERE workspace = ${workspace} AND document_type_id = ${documentTypeId} AND "values" ? ${oldFieldId}::text
      RETURNING node_id
    `) as DatabaseRow[];
    return rows.length;
  }
  async removeDocumentMetadataField(workspace: string, documentTypeId: string, fieldId: string) {
    const rows = (await this.sql`
      UPDATE content_node_document
      SET "values" = "values" - ${fieldId}::text
      WHERE workspace = ${workspace} AND document_type_id = ${documentTypeId} AND "values" ? ${fieldId}::text
      RETURNING node_id
    `) as DatabaseRow[];
    return rows.length;
  }
  async listDocumentTemplates(
    workspace: string,
    projectId?: string | null,
    includeArchived = false
  ) {
    const rows =
      projectId === undefined
        ? await this.sql.unsafe<DatabaseRow[]>(
            `SELECT * FROM document_template WHERE workspace = $1 ${includeArchived ? '' : 'AND archived = FALSE'} ORDER BY name`,
            [workspace]
          )
        : projectId === null
          ? await this.sql.unsafe<DatabaseRow[]>(
              `SELECT * FROM document_template WHERE workspace = $1 AND project_id IS NULL ${includeArchived ? '' : 'AND archived = FALSE'} ORDER BY name`,
              [workspace]
            )
          : await this.sql.unsafe<DatabaseRow[]>(
              `SELECT * FROM document_template WHERE workspace = $1 AND project_id = $2 ${includeArchived ? '' : 'AND archived = FALSE'} ORDER BY name`,
              [workspace, projectId]
            );
    return mapDatabaseRows(rows, templateMapper);
  }
  async getDocumentTemplate(workspace: string, id: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      'SELECT * FROM document_template WHERE workspace = $1 AND id = $2',
      [workspace, id]
    );
    return mapDatabaseRow(rows[0], templateMapper);
  }
  async createDocumentTemplate(input: DocumentTemplateDbCreate) {
    try {
      await this
        .sql`INSERT INTO document_template (id, workspace, project_id, name, body, document_type_id, metadata_defaults, archived, created_at, updated_at) VALUES (${input.id}, ${input.workspace}, ${input.project_id ?? null}, ${input.name}, ${input.body}, ${input.document_type_id}, ${this.json(input.metadata_defaults)}, FALSE, ${input.created_at}, ${input.updated_at})`;
      return (await this.getDocumentTemplate(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
  async updateDocumentTemplate(
    workspace: string,
    id: string,
    input: DocumentTemplateWrite & { updated_at: Date }
  ) {
    try {
      await this
        .sql`UPDATE document_template SET project_id = ${input.project_id ?? null}, name = ${input.name}, body = ${input.body}, document_type_id = ${input.document_type_id}, metadata_defaults = ${this.json(input.metadata_defaults)}, updated_at = ${input.updated_at} WHERE workspace = ${workspace} AND id = ${id}`;
      return await this.getDocumentTemplate(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
  async archiveDocumentTemplate(
    workspace: string,
    id: string,
    archived: boolean,
    updated_at: Date
  ) {
    try {
      await this
        .sql`UPDATE document_template SET archived = ${archived}, updated_at = ${updated_at} WHERE workspace = ${workspace} AND id = ${id}`;
      return await this.getDocumentTemplate(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
  async deleteDocumentTemplate(workspace: string, id: string) {
    try {
      await this.sql`DELETE FROM document_template WHERE workspace = ${workspace} AND id = ${id}`;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
  async getDocumentMetadata(workspace: string, nodeId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      'SELECT * FROM content_node_document WHERE workspace = $1 AND node_id = $2',
      [workspace, nodeId]
    );
    return mapDatabaseRow(rows[0], metadataMapper);
  }
  async upsertDocumentMetadata(input: DocumentMetadataDbUpsert) {
    await this
      .sql`INSERT INTO content_node_document (workspace, node_id, document_type_id, "values", updated_at) VALUES (${input.workspace}, ${input.node_id}, ${input.document_type_id}, ${this.json(input.values)}, ${input.updated_at}) ON CONFLICT (node_id) DO UPDATE SET document_type_id = EXCLUDED.document_type_id, "values" = EXCLUDED."values", updated_at = EXCLUDED.updated_at`;
  }
  async deleteDocumentMetadata(workspace: string, nodeId: string) {
    await this
      .sql`DELETE FROM document_link_index WHERE workspace = ${workspace} AND node_id = ${nodeId}`;
    await this
      .sql`DELETE FROM content_node_document WHERE workspace = ${workspace} AND node_id = ${nodeId}`;
  }
  async listDocumentLinks(workspace: string, nodeId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      'SELECT * FROM document_link_index WHERE workspace = $1 AND node_id = $2 ORDER BY field_id, position',
      [workspace, nodeId]
    );
    return mapDatabaseRows(rows, linkMapper);
  }
  async replaceDocumentLinks(
    workspace: string,
    nodeId: string,
    links: Array<{
      field_id: string;
      target_type: 'entity' | 'document';
      target_id: string;
      position: number;
    }>
  ) {
    await this
      .sql`DELETE FROM document_link_index WHERE workspace = ${workspace} AND node_id = ${nodeId}`;
    for (const link of links)
      await this
        .sql`INSERT INTO document_link_index (workspace, node_id, field_id, target_type, target_id, position) VALUES (${workspace}, ${nodeId}, ${link.field_id}, ${link.target_type}, ${link.target_id}, ${link.position})`;
  }
  async listDocumentsLinkingEntity(workspace: string, entityId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      'SELECT * FROM document_link_index WHERE workspace = $1 AND target_type = $2 AND target_id = $3 ORDER BY node_id, field_id, position',
      [workspace, 'entity', entityId]
    );
    return mapDatabaseRows(rows, linkMapper);
  }
  async listDocumentsLinkingDocument(workspace: string, documentId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      'SELECT * FROM document_link_index WHERE workspace = $1 AND target_type = $2 AND target_id = $3 ORDER BY node_id, field_id, position',
      [workspace, 'document', documentId]
    );
    return mapDatabaseRows(rows, linkMapper);
  }
}

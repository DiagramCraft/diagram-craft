import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseBoolean, databaseDate, parseDatabaseJson } from '../../../db/rowMappers';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  DocumentDatabase,
  DocumentMetadataDbUpsert,
  DocumentMetadataGenerationScheduleDbResult,
  DocumentMetadataGenerationScheduleDbUpsert,
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
  aiActions: parseDatabaseJson(row['ai_actions'], [], 'document_type_version.ai_actions'),
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
  generated_metadata: parseDatabaseJson(
    row['generated_metadata'],
    {},
    'content_node_document.generated_metadata'
  ),
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

const generationScheduleMapper = (
  row: DatabaseRow
): DocumentMetadataGenerationScheduleDbResult => ({
  workspace: String(row['workspace']),
  node_id: String(row['node_id']),
  action_id: String(row['action_id']),
  run_after_at: databaseDate(row['run_after_at']),
  source_revision: Number(row['source_revision']),
  generator_version: Number(row['generator_version']),
  scheduled_by_user_id: String(row['scheduled_by_user_id']),
  attempt_count: Number(row['attempt_count']),
  updated_at: databaseDate(row['updated_at'])
});

export class SqliteDocumentDatabase extends SqliteDatabaseBase implements DocumentDatabase {
  private syncDocumentFields(
    workspace: string,
    documentTypeId: string,
    fields: DocumentTypeWrite['fields'],
    timestamp: Date
  ) {
    const remaining = new Set(
      this.all<{ id: string }>(
        'SELECT id FROM document_field WHERE workspace = ? AND document_type_id = ?',
        [workspace, documentTypeId]
      ).map(row => row.id)
    );
    for (const field of fields) {
      this.run(
        `INSERT INTO document_field (id, workspace, document_type_id, name, type, requirement, min_cardinality, max_cardinality, enum_options, inverse_name, retired, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace, document_type_id, id) DO UPDATE SET name = excluded.name, type = excluded.type, requirement = excluded.requirement, min_cardinality = excluded.min_cardinality, max_cardinality = excluded.max_cardinality, enum_options = excluded.enum_options, inverse_name = excluded.inverse_name, retired = excluded.retired, updated_at = excluded.updated_at`,
        [
          field.id,
          workspace,
          documentTypeId,
          field.name,
          field.type,
          field.requirement,
          field.minCardinality ?? null,
          field.maxCardinality ?? null,
          JSON.stringify(field.enumOptions ?? []),
          field.inverseName ?? null,
          field.retired ? 1 : 0,
          timestamp.toISOString(),
          timestamp.toISOString()
        ]
      );
      remaining.delete(field.id);
    }
    for (const fieldId of remaining) {
      this.run(
        'DELETE FROM document_field WHERE workspace = ? AND document_type_id = ? AND id = ?',
        [workspace, documentTypeId, fieldId]
      );
    }
  }

  async listDocumentTypes(workspace: string, includeArchived = false) {
    return this.all(
      `SELECT * FROM document_type WHERE workspace = ? ${includeArchived ? '' : 'AND archived = 0'} ORDER BY name`,
      [workspace],
      typeMapper
    );
  }

  async getDocumentType(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM document_type WHERE workspace = ? AND id = ?',
      [workspace, id],
      typeMapper
    );
  }

  async createDocumentType(input: DocumentTypeDbCreate) {
    this.run(
      'INSERT INTO document_type (id, workspace, name, description, fields, color, icon, ai_actions, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        JSON.stringify(input.fields),
        input.color ?? null,
        input.icon ?? null,
        JSON.stringify(input.aiActions ?? []),
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    this.syncDocumentFields(input.workspace, input.id, input.fields, input.updated_at);
    return (await this.getDocumentType(input.workspace, input.id))!;
  }

  async updateDocumentType(
    workspace: string,
    id: string,
    input: DocumentTypeWrite & { updated_at: Date; version?: number }
  ) {
    this.run(
      'UPDATE document_type SET name = ?, description = ?, fields = ?, color = ?, icon = ?, ai_actions = ?, version = COALESCE(?, version), updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        input.description,
        JSON.stringify(input.fields),
        input.color ?? null,
        input.icon ?? null,
        JSON.stringify(input.aiActions ?? []),
        input.version ?? null,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    this.syncDocumentFields(workspace, id, input.fields, input.updated_at);
    return await this.getDocumentType(workspace, id);
  }

  async archiveDocumentType(workspace: string, id: string, archived: boolean, updated_at: Date) {
    this.run(
      'UPDATE document_type SET archived = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [archived ? 1 : 0, updated_at.toISOString(), workspace, id]
    );
    return await this.getDocumentType(workspace, id);
  }

  async deleteDocumentType(workspace: string, id: string) {
    this.run('DELETE FROM document_type WHERE workspace = ? AND id = ?', [workspace, id]);
  }

  async listDocumentTypeVersions(workspace: string, documentTypeId: string) {
    return this.all(
      'SELECT * FROM document_type_version WHERE workspace = ? AND document_type_id = ? ORDER BY version DESC',
      [workspace, documentTypeId],
      typeVersionMapper
    );
  }

  async createDocumentTypeVersion(input: DocumentTypeVersionDbCreate) {
    this.run(
      'INSERT INTO document_type_version (id, workspace, document_type_id, version, name, description, fields, ai_actions, color, icon, change_summary, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.document_type_id,
        input.version,
        input.name,
        input.description,
        JSON.stringify(input.fields),
        JSON.stringify(input.aiActions ?? []),
        input.color,
        input.icon,
        JSON.stringify(input.change_summary),
        input.created_by,
        input.created_at.toISOString()
      ]
    );
    return (await this.get(
      'SELECT * FROM document_type_version WHERE workspace = ? AND document_type_id = ? AND version = ?',
      [input.workspace, input.document_type_id, input.version],
      typeVersionMapper
    ))!;
  }

  async renameDocumentMetadataField(
    workspace: string,
    documentTypeId: string,
    oldFieldId: string,
    newFieldId: string
  ) {
    const result = this.run(
      `UPDATE content_node_document
       SET "values" = json_set(json_remove("values", '$."' || ? || '"'), '$."' || ? || '"', json_extract("values", '$."' || ? || '"'))
         , generated_metadata = CASE
           WHEN json_type(generated_metadata, '$."' || ? || '"') IS NOT NULL
           THEN json_set(
             json_remove(generated_metadata, '$."' || ? || '"'),
             '$."' || ? || '"',
             json_set(json_extract(generated_metadata, '$."' || ? || '"'), '$.fieldId', ?)
           )
           ELSE generated_metadata
         END
       WHERE workspace = ? AND document_type_id = ?
         AND (json_extract("values", '$."' || ? || '"') IS NOT NULL OR json_type(generated_metadata, '$."' || ? || '"') IS NOT NULL)`,
      [
        oldFieldId,
        newFieldId,
        oldFieldId,
        oldFieldId,
        oldFieldId,
        newFieldId,
        oldFieldId,
        newFieldId,
        workspace,
        documentTypeId,
        oldFieldId,
        oldFieldId
      ]
    );
    return result.changes;
  }

  async removeDocumentMetadataField(workspace: string, documentTypeId: string, fieldId: string) {
    const result = this.run(
      `UPDATE content_node_document
       SET "values" = json_remove("values", '$."' || ? || '"'),
           generated_metadata = json_remove(generated_metadata, '$."' || ? || '"')
       WHERE workspace = ? AND document_type_id = ?
         AND (json_extract("values", '$."' || ? || '"') IS NOT NULL OR json_type(generated_metadata, '$."' || ? || '"') IS NOT NULL)`,
      [fieldId, fieldId, workspace, documentTypeId, fieldId, fieldId]
    );
    return result.changes;
  }

  async listDocumentTemplates(
    workspace: string,
    projectId?: string | null,
    includeArchived = false
  ) {
    const projectClause =
      projectId === undefined
        ? ''
        : projectId === null
          ? 'AND project_id IS NULL'
          : 'AND project_id = ?';
    const params =
      projectId === undefined
        ? [workspace]
        : projectId === null
          ? [workspace]
          : [workspace, projectId];
    return this.all(
      `SELECT * FROM document_template WHERE workspace = ? ${projectClause} ${includeArchived ? '' : 'AND archived = 0'} ORDER BY name`,
      params,
      templateMapper
    );
  }

  async getDocumentTemplate(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM document_template WHERE workspace = ? AND id = ?',
      [workspace, id],
      templateMapper
    );
  }

  async createDocumentTemplate(input: DocumentTemplateDbCreate) {
    this.run(
      'INSERT INTO document_template (id, workspace, project_id, name, body, document_type_id, metadata_defaults, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [
        input.id,
        input.workspace,
        input.project_id ?? null,
        input.name,
        input.body,
        input.document_type_id,
        JSON.stringify(input.metadata_defaults),
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getDocumentTemplate(input.workspace, input.id))!;
  }

  async updateDocumentTemplate(
    workspace: string,
    id: string,
    input: DocumentTemplateWrite & { updated_at: Date }
  ) {
    this.run(
      'UPDATE document_template SET project_id = ?, name = ?, body = ?, document_type_id = ?, metadata_defaults = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.project_id ?? null,
        input.name,
        input.body,
        input.document_type_id,
        JSON.stringify(input.metadata_defaults),
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getDocumentTemplate(workspace, id);
  }

  async archiveDocumentTemplate(
    workspace: string,
    id: string,
    archived: boolean,
    updated_at: Date
  ) {
    this.run(
      'UPDATE document_template SET archived = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [archived ? 1 : 0, updated_at.toISOString(), workspace, id]
    );
    return await this.getDocumentTemplate(workspace, id);
  }

  async deleteDocumentTemplate(workspace: string, id: string) {
    this.run('DELETE FROM document_template WHERE workspace = ? AND id = ?', [workspace, id]);
  }

  async getDocumentMetadata(workspace: string, nodeId: string) {
    return this.get(
      'SELECT * FROM content_node_document WHERE workspace = ? AND node_id = ?',
      [workspace, nodeId],
      metadataMapper
    );
  }

  async upsertDocumentMetadata(input: DocumentMetadataDbUpsert) {
    const generatedMetadata = input.generated_metadata;
    const generatedMetadataSql =
      generatedMetadata === undefined ? JSON.stringify({}) : JSON.stringify(generatedMetadata);
    this.run(
      `INSERT INTO content_node_document (workspace, node_id, document_type_id, "values", generated_metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(node_id) DO UPDATE SET document_type_id = excluded.document_type_id, "values" = excluded."values", ${generatedMetadata === undefined ? '' : 'generated_metadata = excluded.generated_metadata,'} updated_at = excluded.updated_at`,
      [
        input.workspace,
        input.node_id,
        input.document_type_id,
        JSON.stringify(input.values),
        generatedMetadataSql,
        input.updated_at.toISOString()
      ]
    );
  }

  async deleteDocumentMetadata(workspace: string, nodeId: string) {
    this.run('DELETE FROM document_link_index WHERE workspace = ? AND node_id = ?', [
      workspace,
      nodeId
    ]);
    this.run('DELETE FROM content_node_document WHERE workspace = ? AND node_id = ?', [
      workspace,
      nodeId
    ]);
  }

  async listDocumentLinks(workspace: string, nodeId: string) {
    return this.all(
      'SELECT * FROM document_link_index WHERE workspace = ? AND node_id = ? ORDER BY field_id, position',
      [workspace, nodeId],
      linkMapper
    );
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
    const replace = () => {
      this.run('DELETE FROM document_link_index WHERE workspace = ? AND node_id = ?', [
        workspace,
        nodeId
      ]);
      for (const link of links)
        this.run(
          'INSERT INTO document_link_index (workspace, node_id, field_id, target_type, target_id, position) VALUES (?, ?, ?, ?, ?, ?)',
          [workspace, nodeId, link.field_id, link.target_type, link.target_id, link.position]
        );
    };
    if ((this.db as typeof this.db & { inTransaction: boolean }).inTransaction) replace();
    else this.db.transaction(replace)();
  }

  async listDocumentsLinkingEntity(workspace: string, entityId: string) {
    return this.all(
      'SELECT * FROM document_link_index WHERE workspace = ? AND target_type = ? AND target_id = ? ORDER BY node_id, field_id, position',
      [workspace, 'entity', entityId],
      linkMapper
    );
  }

  async listDocumentsLinkingDocument(workspace: string, documentId: string) {
    return this.all(
      'SELECT * FROM document_link_index WHERE workspace = ? AND target_type = ? AND target_id = ? ORDER BY node_id, field_id, position',
      [workspace, 'document', documentId],
      linkMapper
    );
  }

  async markGeneratedMetadataOutdatedForDocumentType(workspace: string, documentTypeId: string) {
    this.run(
      `UPDATE content_node_document
       SET generated_metadata = (
         SELECT json_group_object(je.key, json_set(je.value, '$.status', 'outdated'))
         FROM json_each(content_node_document.generated_metadata) AS je
       )
       WHERE workspace = ? AND document_type_id = ? AND generated_metadata != '{}'`,
      [workspace, documentTypeId]
    );
  }

  async upsertPendingMetadataGeneration(input: DocumentMetadataGenerationScheduleDbUpsert) {
    this.run(
      `INSERT INTO document_metadata_generation_schedule
         (workspace, node_id, action_id, run_after_at, source_revision, generator_version, scheduled_by_user_id, attempt_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace, node_id, action_id) DO UPDATE SET
         run_after_at = excluded.run_after_at,
         source_revision = excluded.source_revision,
         generator_version = excluded.generator_version,
         scheduled_by_user_id = excluded.scheduled_by_user_id,
         attempt_count = excluded.attempt_count,
         updated_at = excluded.updated_at`,
      [
        input.workspace,
        input.node_id,
        input.action_id,
        input.run_after_at.toISOString(),
        input.source_revision,
        input.generator_version,
        input.scheduled_by_user_id,
        input.attempt_count ?? 0,
        input.updated_at.toISOString()
      ]
    );
  }

  async claimDueMetadataGenerations(workspace: string, now: Date) {
    return this.all(
      `DELETE FROM document_metadata_generation_schedule
       WHERE workspace = ? AND run_after_at <= ?
       RETURNING *`,
      [workspace, now.toISOString()],
      generationScheduleMapper
    );
  }
}

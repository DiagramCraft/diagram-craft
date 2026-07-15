import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseBoolean, databaseDate, parseDatabaseJson } from '../../../db/rowMappers';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  DocumentDatabase,
  DocumentMetadataDbUpsert,
  DocumentTemplateDbCreate,
  DocumentTemplateDbResult,
  DocumentTypeDbCreate,
  DocumentTypeDbResult
} from './documentDatabase';
import type { DocumentTemplateWrite, DocumentTypeWrite } from '@arch-register/api-types/documentContract';

const typeMapper = (row: DatabaseRow): DocumentTypeDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  name: String(row['name']),
  description: String(row['description'] ?? ''),
  fields: parseDatabaseJson(row['fields'], [], 'document_type.fields'),
  color: row['color'] == null ? null : String(row['color']),
  icon: row['icon'] == null ? null : String(row['icon']),
  archived: databaseBoolean(row['archived']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at'])
});

const templateMapper = (row: DatabaseRow): DocumentTemplateDbResult => {
  if (row['document_type_id'] == null) throw new Error('Document template is missing a document type');
  return {
    id: String(row['id']),
    workspace: String(row['workspace']),
    project_id: row['project_id'] == null ? null : String(row['project_id']),
    name: String(row['name']),
    body: String(row['body']),
    document_type_id: String(row['document_type_id']),
    metadata_defaults: parseDatabaseJson(row['metadata_defaults'], {}, 'document_template.metadata_defaults'),
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

export class SqliteDocumentDatabase extends SqliteDatabaseBase implements DocumentDatabase {
  private syncDocumentFields(workspace: string, documentTypeId: string, fields: DocumentTypeWrite['fields'], timestamp: Date) {
    const remaining = new Set(this.all<{ id: string }>('SELECT id FROM document_field WHERE workspace = ? AND document_type_id = ?', [workspace, documentTypeId]).map(row => row.id));
    for (const field of fields) {
      this.run(
        `INSERT INTO document_field (id, workspace, document_type_id, name, type, requirement, min_cardinality, max_cardinality, enum_options, retired, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace, document_type_id, id) DO UPDATE SET name = excluded.name, type = excluded.type, requirement = excluded.requirement, min_cardinality = excluded.min_cardinality, max_cardinality = excluded.max_cardinality, enum_options = excluded.enum_options, retired = excluded.retired, updated_at = excluded.updated_at`,
        [field.id, workspace, documentTypeId, field.name, field.type, field.requirement, field.minCardinality ?? null, field.maxCardinality ?? null, JSON.stringify(field.enumOptions ?? []), field.retired ? 1 : 0, timestamp.toISOString(), timestamp.toISOString()]
      );
      remaining.delete(field.id);
    }
    for (const fieldId of remaining) {
      this.run('DELETE FROM document_field WHERE workspace = ? AND document_type_id = ? AND id = ?', [workspace, documentTypeId, fieldId]);
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
    return this.get('SELECT * FROM document_type WHERE workspace = ? AND id = ?', [workspace, id], typeMapper);
  }

  async createDocumentType(input: DocumentTypeDbCreate) {
    this.run(
      'INSERT INTO document_type (id, workspace, name, description, fields, color, icon, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [input.id, input.workspace, input.name, input.description, JSON.stringify(input.fields), input.color ?? null, input.icon ?? null, input.created_at.toISOString(), input.updated_at.toISOString()]
    );
    this.syncDocumentFields(input.workspace, input.id, input.fields, input.updated_at);
    return (await this.getDocumentType(input.workspace, input.id))!;
  }

  async updateDocumentType(workspace: string, id: string, input: DocumentTypeWrite & { updated_at: Date }) {
    this.run(
      'UPDATE document_type SET name = ?, description = ?, fields = ?, color = ?, icon = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [input.name, input.description, JSON.stringify(input.fields), input.color ?? null, input.icon ?? null, input.updated_at.toISOString(), workspace, id]
    );
    this.syncDocumentFields(workspace, id, input.fields, input.updated_at);
    return await this.getDocumentType(workspace, id);
  }

  async archiveDocumentType(workspace: string, id: string, archived: boolean, updated_at: Date) {
    this.run('UPDATE document_type SET archived = ?, updated_at = ? WHERE workspace = ? AND id = ?', [archived ? 1 : 0, updated_at.toISOString(), workspace, id]);
    return await this.getDocumentType(workspace, id);
  }

  async deleteDocumentType(workspace: string, id: string) {
    this.run('DELETE FROM document_type WHERE workspace = ? AND id = ?', [workspace, id]);
  }

  async listDocumentTemplates(workspace: string, projectId?: string | null, includeArchived = false) {
    const projectClause = projectId === undefined ? '' : projectId === null ? 'AND project_id IS NULL' : 'AND project_id = ?';
    const params = projectId === undefined ? [workspace] : projectId === null ? [workspace] : [workspace, projectId];
    return this.all(
      `SELECT * FROM document_template WHERE workspace = ? ${projectClause} ${includeArchived ? '' : 'AND archived = 0'} ORDER BY name`,
      params,
      templateMapper
    );
  }

  async getDocumentTemplate(workspace: string, id: string) {
    return this.get('SELECT * FROM document_template WHERE workspace = ? AND id = ?', [workspace, id], templateMapper);
  }

  async createDocumentTemplate(input: DocumentTemplateDbCreate) {
    this.run(
      'INSERT INTO document_template (id, workspace, project_id, name, body, document_type_id, metadata_defaults, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [input.id, input.workspace, input.project_id ?? null, input.name, input.body, input.document_type_id, JSON.stringify(input.metadata_defaults), input.created_at.toISOString(), input.updated_at.toISOString()]
    );
    return (await this.getDocumentTemplate(input.workspace, input.id))!;
  }

  async updateDocumentTemplate(workspace: string, id: string, input: DocumentTemplateWrite & { updated_at: Date }) {
    this.run(
      'UPDATE document_template SET project_id = ?, name = ?, body = ?, document_type_id = ?, metadata_defaults = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [input.project_id ?? null, input.name, input.body, input.document_type_id, JSON.stringify(input.metadata_defaults), input.updated_at.toISOString(), workspace, id]
    );
    return await this.getDocumentTemplate(workspace, id);
  }

  async archiveDocumentTemplate(workspace: string, id: string, archived: boolean, updated_at: Date) {
    this.run('UPDATE document_template SET archived = ?, updated_at = ? WHERE workspace = ? AND id = ?', [archived ? 1 : 0, updated_at.toISOString(), workspace, id]);
    return await this.getDocumentTemplate(workspace, id);
  }

  async deleteDocumentTemplate(workspace: string, id: string) {
    this.run('DELETE FROM document_template WHERE workspace = ? AND id = ?', [workspace, id]);
  }

  async getDocumentMetadata(workspace: string, nodeId: string) {
    return this.get('SELECT * FROM content_node_document WHERE workspace = ? AND node_id = ?', [workspace, nodeId], metadataMapper);
  }

  async upsertDocumentMetadata(input: DocumentMetadataDbUpsert) {
    this.run(
      `INSERT INTO content_node_document (workspace, node_id, document_type_id, "values", updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(node_id) DO UPDATE SET document_type_id = excluded.document_type_id, "values" = excluded."values", updated_at = excluded.updated_at`,
      [input.workspace, input.node_id, input.document_type_id, JSON.stringify(input.values), input.updated_at.toISOString()]
    );
  }

  async deleteDocumentMetadata(workspace: string, nodeId: string) {
    this.run('DELETE FROM content_node_document WHERE workspace = ? AND node_id = ?', [workspace, nodeId]);
  }

  async listDocumentLinks(workspace: string, nodeId: string) {
    return this.all('SELECT * FROM document_link_index WHERE workspace = ? AND node_id = ? ORDER BY field_id, position', [workspace, nodeId], linkMapper);
  }

  async replaceDocumentLinks(workspace: string, nodeId: string, links: Array<{ field_id: string; target_type: 'entity' | 'document'; target_id: string; position: number }>) {
    const replace = () => {
      this.run('DELETE FROM document_link_index WHERE workspace = ? AND node_id = ?', [workspace, nodeId]);
      for (const link of links) this.run('INSERT INTO document_link_index (workspace, node_id, field_id, target_type, target_id, position) VALUES (?, ?, ?, ?, ?, ?)', [workspace, nodeId, link.field_id, link.target_type, link.target_id, link.position]);
    };
    if ((this.db as typeof this.db & { inTransaction: boolean }).inTransaction) replace();
    else this.db.transaction(replace)();
  }

  async listDocumentsLinkingEntity(workspace: string, entityId: string) {
    return this.all('SELECT * FROM document_link_index WHERE workspace = ? AND target_type = ? AND target_id = ? ORDER BY node_id, field_id, position', [workspace, 'entity', entityId], linkMapper);
  }
}

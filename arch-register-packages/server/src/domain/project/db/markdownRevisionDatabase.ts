import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export const MARKDOWN_REVISION_SELECT_SQL = `
  SELECT mr.*, u.display_name AS created_by_name
  FROM content_node_revision mr
  LEFT JOIN users u ON u.id = mr.created_by
`;

export type MarkdownRevisionDbResult = {
  id: string;
  workspace: string;
  node_id: string;
  revision_number: number;
  title: string | null;
  body: string;
  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;
  restored_from_revision_id: string | null;
  document_type_id: string | null;
  metadata: DocumentMetadata;
};

export type MarkdownRevisionDbCreate = {
  id?: string;
  workspace: string;
  node_id: string;
  revision_number: number;
  title: string | null;
  body: string;
  created_at: Date;
  created_by: string | null;
  restored_from_revision_id?: string | null;
  document_type_id?: string | null;
  metadata?: DocumentMetadata;
};

export const markdownRevisionMapper = (row: DatabaseRow): MarkdownRevisionDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  node_id: String(row['node_id']),
  revision_number: Number(row['revision_number']),
  title: row['title'] == null ? null : String(row['title']),
  body: String(row['body']),
  created_at: databaseDate(row['created_at']),
  created_by: row['created_by'] == null ? null : String(row['created_by']),
  created_by_name: row['created_by_name'] == null ? null : String(row['created_by_name']),
  restored_from_revision_id:
    row['restored_from_revision_id'] == null ? null : String(row['restored_from_revision_id']),
  document_type_id: row['document_type_id'] == null ? null : String(row['document_type_id']),
  metadata: parseDatabaseJson(row['metadata'], {}, 'content_node_revision.metadata')
});

export type MarkdownRevisionDatabase = {
  listMarkdownRevisions(ws: string, nodeId: string): Promise<MarkdownRevisionDbResult[]>;
  getMarkdownRevision(
    ws: string,
    nodeId: string,
    revisionId: string
  ): Promise<MarkdownRevisionDbResult | null>;
  createMarkdownRevision(input: MarkdownRevisionDbCreate): Promise<MarkdownRevisionDbResult>;
  getNextMarkdownRevisionNumber(ws: string, nodeId: string): Promise<number>;
};

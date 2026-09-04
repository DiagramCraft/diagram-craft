import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export const DIAGRAM_ENTITY_FILE_SELECT_SQL = `
  SELECT
    pf.id          AS file_id,
    pf.path        AS file_path,
    pf.name        AS file_name,
    pf.size_bytes  AS file_size_bytes,
    pf.type        AS file_type,
    pf.preview_svg AS file_preview_svg,
    pf.comment_count AS file_comment_count,
    pf.unresolved_comment_count AS file_unresolved_comment_count,
    pf.created_at  AS file_created_at,
    pf.updated_at  AS file_updated_at,
    cm.title       AS file_metadata_title,
    cm.description AS file_metadata_description,
    cm.company     AS file_metadata_company,
    cm.category    AS file_metadata_category,
    cm.keywords    AS file_metadata_keywords,
    p.id           AS project_id,
    p.public_id    AS project_public_id,
    p.name         AS project_name
  FROM diagram_entity_ref der
  JOIN content_node pf ON pf.id = der.file_id AND pf.workspace = der.workspace
  LEFT JOIN content_metadata cm ON cm.workspace = pf.workspace AND cm.node_id = pf.id
  LEFT JOIN project p ON p.id = pf.project_id AND p.workspace = pf.workspace
`;

export type DiagramEntityFileDbResult = {
  file_id: string;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  file_type: 'diagram' | 'folder' | 'markdown' | 'file';
  file_preview_svg: string | null;
  file_created_at: Date;
  file_updated_at: Date;
  project_id: string;
  project_public_id: string;
  project_name: string;
  file_comment_count: number;
  file_unresolved_comment_count: number;
  file_metadata_title: string | null;
  file_metadata_description: string | null;
  file_metadata_company: string | null;
  file_metadata_category: string | null;
  file_metadata_keywords: string[];
};

export const diagramEntityFileMapper = (row: DatabaseRow): DiagramEntityFileDbResult => ({
  file_id: String(row['file_id']),
  file_path: String(row['file_path']),
  file_name: String(row['file_name']),
  file_size_bytes: Number(row['file_size_bytes']),
  file_type: String(row['file_type']) as DiagramEntityFileDbResult['file_type'],
  file_preview_svg: row['file_preview_svg'] == null ? null : String(row['file_preview_svg']),
  file_created_at: databaseDate(row['file_created_at']),
  file_updated_at: databaseDate(row['file_updated_at']),
  project_id: String(row['project_id']),
  project_public_id: String(row['project_public_id']),
  project_name: String(row['project_name']),
  file_comment_count: Number(row['file_comment_count'] ?? 0),
  file_unresolved_comment_count: Number(row['file_unresolved_comment_count'] ?? 0),
  file_metadata_title:
    row['file_metadata_title'] == null ? null : String(row['file_metadata_title']),
  file_metadata_description:
    row['file_metadata_description'] == null ? null : String(row['file_metadata_description']),
  file_metadata_company:
    row['file_metadata_company'] == null ? null : String(row['file_metadata_company']),
  file_metadata_category:
    row['file_metadata_category'] == null ? null : String(row['file_metadata_category']),
  file_metadata_keywords: parseDatabaseJson(
    row['file_metadata_keywords'],
    [],
    'content_node.metadata_keywords'
  )
});

export type DiagramEntityRefDatabase = {
  syncDiagramEntityRefs(ws: string, fileId: string, entityIds: string[]): Promise<void>;
  getEntityDiagramFiles(ws: string, entityId: string): Promise<DiagramEntityFileDbResult[]>;
};

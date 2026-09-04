import type { DatabaseRow } from '../../../db/rowMappers';
import { databaseBoolean, databaseDate, parseDatabaseJson } from '../../../db/rowMappers';

export const CONTENT_NODE_SELECT_SQL = `
  SELECT
    cn.*,
    cm.title AS metadata_title,
    cm.description AS metadata_description,
    cm.company AS metadata_company,
    cm.category AS metadata_category,
    cm.keywords AS metadata_keywords,
    dt.icon AS document_type_icon
  FROM content_node cn
  LEFT JOIN content_metadata cm ON cm.workspace = cn.workspace AND cm.node_id = cn.id
  LEFT JOIN content_node_document cnd ON cnd.workspace = cn.workspace AND cnd.node_id = cn.id
  LEFT JOIN document_type dt ON dt.workspace = cnd.workspace AND dt.id = cnd.document_type_id
`;

export type ContentNodeDbResult = {
  id: string;
  workspace: string;
  project_id: string | null;
  project_public_id?: string | null;
  entity_id: string | null;
  parent_id: string | null;
  path: string;
  name: string;
  role?: 'attachment-container' | null;
  type: 'diagram' | 'folder' | 'markdown' | 'file';
  size_bytes: number;
  comment_count: number;
  unresolved_comment_count: number;
  is_template: boolean;
  is_workspace_template: boolean;
  preview_svg: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
  mime_type: string | null;
  original_filename: string | null;
  mount_id?: string | null;
  metadata_title?: string | null;
  metadata_description?: string | null;
  metadata_company?: string | null;
  metadata_category?: string | null;
  metadata_keywords?: string[];
  document_type_icon?: string | null;
};

export type ContentMetadataDbResult = {
  workspace: string;
  node_id: string;
  title: string | null;
  description: string | null;
  company: string | null;
  category: string | null;
  keywords: string[];
  updated_at: Date;
};

export type ContentMetadataDbUpsert = {
  workspace: string;
  node_id: string;
  title: string | null;
  description: string | null;
  company: string | null;
  category: string | null;
  keywords: string[];
  updated_at: Date;
};

export type ContentNodeDbUpsert = {
  id?: string;
  workspace: string;
  project_id?: string | null;
  entity_id?: string | null;
  parent_id?: string | null;
  path: string;
  name: string;
  role?: 'attachment-container' | null;
  type?: 'diagram' | 'folder' | 'markdown' | 'file';
  size_bytes: number;
  comment_count: number;
  unresolved_comment_count: number;
  updated_at: Date;
  created_atIfNew: Date;
  created_byIfNew?: string | null;
  updated_by?: string | null;
  mime_type?: string | null;
  original_filename?: string | null;
  mount_id?: string | null;
};

export const contentNodeMapper = (row: DatabaseRow): ContentNodeDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  project_id: row['project_id'] == null ? null : String(row['project_id']),
  entity_id: row['entity_id'] == null ? null : String(row['entity_id']),
  parent_id: row['parent_id'] == null ? null : String(row['parent_id']),
  path: String(row['path']),
  name: String(row['name']),
  role: row['role'] == null ? null : (String(row['role']) as 'attachment-container'),
  type: String(row['type']) as ContentNodeDbResult['type'],
  size_bytes: Number(row['size_bytes']),
  comment_count: Number(row['comment_count'] ?? 0),
  unresolved_comment_count: Number(row['unresolved_comment_count'] ?? 0),
  is_template: databaseBoolean(row['is_template']),
  is_workspace_template: databaseBoolean(row['is_workspace_template']),
  preview_svg: row['preview_svg'] == null ? null : String(row['preview_svg']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at']),
  created_by: row['created_by'] == null ? null : String(row['created_by']),
  updated_by: row['updated_by'] == null ? null : String(row['updated_by']),
  mime_type: row['mime_type'] == null ? null : String(row['mime_type']),
  original_filename: row['original_filename'] == null ? null : String(row['original_filename']),
  mount_id: row['mount_id'] == null ? null : String(row['mount_id']),
  metadata_title: row['metadata_title'] == null ? null : String(row['metadata_title']),
  metadata_description:
    row['metadata_description'] == null ? null : String(row['metadata_description']),
  metadata_company: row['metadata_company'] == null ? null : String(row['metadata_company']),
  metadata_category: row['metadata_category'] == null ? null : String(row['metadata_category']),
  metadata_keywords: parseDatabaseJson(
    row['metadata_keywords'],
    [],
    'content_node.metadata_keywords'
  ),
  document_type_icon: row['document_type_icon'] == null ? null : String(row['document_type_icon'])
});

export type ContentNodeDatabase = {
  listContentNodes(ws: string, projectId: string): Promise<ContentNodeDbResult[]>;
  listAllContentNodes(ws: string): Promise<ContentNodeDbResult[]>;
  listEntityContentNodes(ws: string, entityId: string): Promise<ContentNodeDbResult[]>;
  listWorkspaceContentNodes(ws: string): Promise<ContentNodeDbResult[]>;
  listContentNodesByMount(ws: string, mountId: string): Promise<ContentNodeDbResult[]>;
  getContentNodeByPath(
    ws: string,
    projectId: string,
    path: string
  ): Promise<ContentNodeDbResult | null>;
  getContentNodeById(
    ws: string,
    projectId: string,
    id: string
  ): Promise<ContentNodeDbResult | null>;
  getAnyContentNodeById(ws: string, id: string): Promise<ContentNodeDbResult | null>;
  updateContentNodeSizeById(
    ws: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ): Promise<void>;
  updateContentNodePreview(
    ws: string,
    projectId: string,
    fileId: string,
    previewSvg: string | null
  ): Promise<void>;
  updateContentNodeDerivedData(
    ws: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    commentCount: number,
    unresolvedCommentCount: number,
    previewSvg: string | null,
    updated_at: Date
  ): Promise<void>;
  updateWorkspaceContentNodeDerivedData(
    ws: string,
    fileId: string,
    sizeBytes: number,
    commentCount: number,
    unresolvedCommentCount: number,
    previewSvg: string | null,
    updated_at: Date
  ): Promise<void>;
  updateContentNodeTemplateStatus(
    ws: string,
    projectId: string,
    fileId: string,
    isTemplate: boolean,
    isWorkspaceTemplate: boolean,
    updated_at: Date
  ): Promise<void>;
  upsertContentMetadata(input: ContentMetadataDbUpsert): Promise<void>;
  deleteContentMetadata(ws: string, nodeId: string): Promise<void>;
  upsertContentNode(input: ContentNodeDbUpsert): Promise<ContentNodeDbResult>;
  createContentNodeIfAbsent(input: ContentNodeDbUpsert): Promise<ContentNodeDbResult | null>;
  deleteContentNodesByIds(ws: string, nodeIds: readonly string[]): Promise<void>;
  deleteContentNodeByPath(
    ws: string,
    projectId: string,
    path: string
  ): Promise<ContentNodeDbResult | null>;
  renameContentNodeFolder(
    ws: string,
    projectId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ): Promise<string[]>;
  deleteContentNodeFolder(
    ws: string,
    projectId: string,
    folderPath: string
  ): Promise<ContentNodeDbResult[]>;
  deleteEntityContentNodeByPath(
    ws: string,
    entityId: string,
    path: string
  ): Promise<ContentNodeDbResult | null>;
  renameEntityContentNodeFolder(
    ws: string,
    entityId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ): Promise<string[]>;
  deleteEntityContentNodeFolder(
    ws: string,
    entityId: string,
    folderPath: string
  ): Promise<ContentNodeDbResult[]>;
  deleteWorkspaceContentNodeByPath(ws: string, path: string): Promise<ContentNodeDbResult | null>;
  renameWorkspaceContentNodeFolder(
    ws: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ): Promise<string[]>;
  deleteWorkspaceContentNodeFolder(ws: string, folderPath: string): Promise<ContentNodeDbResult[]>;
};

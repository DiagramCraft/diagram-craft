import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

// Shared read projections. Driver-specific predicates and placeholders are
// appended by the SQLite and PostgreSQL implementations.
export const PROJECT_SELECT_SQL = `
  SELECT p.*, wo.name AS owner_name
  FROM project p
  LEFT JOIN workspace_owner wo ON wo.id = p.owner
`;

export const CONTENT_NODE_SELECT_SQL = `
  SELECT
    cn.*,
    cm.title AS metadata_title,
    cm.description AS metadata_description,
    cm.company AS metadata_company,
    cm.category AS metadata_category,
    cm.keywords AS metadata_keywords
  FROM content_node cn
  LEFT JOIN content_metadata cm ON cm.workspace = cn.workspace AND cm.node_id = cn.id
`;

export const PROJECT_ENTITY_SELECT_SQL = `
  SELECT
    pe.workspace,
    pe.project_id,
    pe.entity_id,
    e.name        AS entity_name,
    e.slug        AS entity_slug,
    e.description AS entity_description,
    e.schema_id   AS entity_schema_id,
    es.name       AS entity_schema_name,
    pe.entity_type AS entity_type_id,
    pet.label     AS entity_type_label,
    pe.is_done
  FROM project_entity pe
  JOIN entity e ON e.id = pe.entity_id AND e.deleted_at IS NULL
  LEFT JOIN entity_schema es ON es.id = e.schema_id
  LEFT JOIN project_entity_type pet ON pet.id = pe.entity_type AND pet.workspace = pe.workspace
`;

export const MARKDOWN_REVISION_SELECT_SQL = `
  SELECT mr.*, u.display_name AS created_by_name
  FROM content_node_revision mr
  LEFT JOIN users u ON u.id = mr.created_by
`;

export const ASSESSMENT_RESPONSE_SELECT_SQL = `
  SELECT ar.*, u.display_name as updated_by_name
  FROM assessment_response ar
  LEFT JOIN users u ON u.id = ar.updated_by
`;

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

// -- Content Node

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
  metadata_title?: string | null;
  metadata_description?: string | null;
  metadata_company?: string | null;
  metadata_category?: string | null;
  metadata_keywords?: string[];
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
};

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
};

// -- Project

type BaseProject = {
  id: string;
  workspace: string;
  public_id?: string;
  name: string;
  description: string;
  owner: string | null;
  status: 'draft' | 'active' | 'complete' | 'cancelled';
  color: string | null;
  target_date: string | null;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
};

export type ProjectDbResult = BaseProject & {
  owner_name: string | null;
};

export type ProjectDbCreate = BaseProject;

export type ProjectDbUpdate = Omit<BaseProject, 'id' | 'workspace' | 'created_at'>;

// -- Project Entity

export type ProjectEntityDbResult = {
  workspace: string;
  project_id: string;
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  entity_description: string;
  entity_schema_id: string | null;
  entity_schema_name: string | null;
  entity_type_id: string | null;
  entity_type_label: string | null;
  is_done: boolean;
};

export type ProjectEntityLinkDbResult = {
  entity_id: string;
  created_at: Date;
};

export type ProjectEntityDbCreate = {
  workspace: string;
  project_id: string;
  entity_id: string;
  entity_type_id: string | null;
  is_done?: boolean;
  created_at: Date;
};

export type EntityProjectDbResult = {
  project: ProjectDbResult;
  file_count: number;
  entity_type_id: string | null;
  entity_type_label: string | null;
};

// -- Diagram Entity Ref

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

// -- Assessment

export type AssessmentDbResult = {
  id: string;
  workspace: string;
  project_id: string;
  name: string;
  description: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
  scope: string[];
  scope_conditions: FilterCondition[];
  fields: AssessmentField[];
  created_at: Date;
  updated_at: Date;
};

export type AssessmentDbCreate = AssessmentDbResult;

export type AssessmentDbUpdate = Omit<
  AssessmentDbResult,
  'id' | 'workspace' | 'project_id' | 'created_at'
>;

// -- Assessment response

export type AssessmentResponseDbResult = {
  id: string;
  workspace: string;
  assessment_id: string;
  entity_id: string;
  values: Record<string, string | number>;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
  updated_by_name: string | null;
};

export type AssessmentResponseDbUpsert = Omit<
  AssessmentResponseDbResult,
  'id' | 'created_at' | 'updated_at' | 'updated_by_name'
>;

export const projectMappers = {
  project: (row: DatabaseRow): ProjectDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    public_id: String(row['public_id']),
    name: String(row['name']),
    description: String(row['description']),
    owner: row['owner'] == null ? null : String(row['owner']),
    status: String(row['status']) as ProjectDbResult['status'],
    color: row['color'] == null ? null : String(row['color']),
    target_date: row['target_date'] == null ? null : String(row['target_date']),
    pinned: databaseBoolean(row['pinned']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    owner_name: row['owner_name'] == null ? null : String(row['owner_name'])
  }),
  contentNode: (row: DatabaseRow): ContentNodeDbResult => ({
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
    metadata_title: row['metadata_title'] == null ? null : String(row['metadata_title']),
    metadata_description:
      row['metadata_description'] == null ? null : String(row['metadata_description']),
    metadata_company: row['metadata_company'] == null ? null : String(row['metadata_company']),
    metadata_category: row['metadata_category'] == null ? null : String(row['metadata_category']),
    metadata_keywords: parseDatabaseJson(
      row['metadata_keywords'],
      [],
      'content_node.metadata_keywords'
    )
  }),
  markdownRevision: (row: DatabaseRow): MarkdownRevisionDbResult => ({
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
      row['restored_from_revision_id'] == null ? null : String(row['restored_from_revision_id'])
  }),
  projectEntity: (row: DatabaseRow): ProjectEntityDbResult => ({
    workspace: String(row['workspace']),
    project_id: String(row['project_id']),
    entity_id: String(row['entity_id']),
    entity_name: String(row['entity_name']),
    entity_slug: String(row['entity_slug']),
    entity_description: String(row['entity_description'] ?? ''),
    entity_schema_id: row['entity_schema_id'] == null ? null : String(row['entity_schema_id']),
    entity_schema_name:
      row['entity_schema_name'] == null ? null : String(row['entity_schema_name']),
    entity_type_id: row['entity_type_id'] == null ? null : String(row['entity_type_id']),
    entity_type_label: row['entity_type_label'] == null ? null : String(row['entity_type_label']),
    is_done: databaseBoolean(row['is_done'])
  }),
  entityProject: (row: DatabaseRow): EntityProjectDbResult => ({
    project: projectMappers.project(row),
    file_count: Number(row['file_count'] ?? 0),
    entity_type_id: row['entity_type_id'] == null ? null : String(row['entity_type_id']),
    entity_type_label:
      row['entity_type_label'] == null ? null : String(row['entity_type_label'])
  }),
  diagramEntityFile: (row: DatabaseRow): DiagramEntityFileDbResult => ({
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
  }),
  assessment: (row: DatabaseRow): AssessmentDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    project_id: String(row['project_id']),
    name: String(row['name']),
    description: String(row['description'] ?? ''),
    status: row['status'] as AssessmentDbResult['status'],
    scope: parseDatabaseJson(row['scope'], [], 'assessment.scope'),
    scope_conditions: parseDatabaseJson(
      row['scope_conditions'],
      [],
      'assessment.scope_conditions'
    ),
    fields: parseDatabaseJson(row['fields'], [], 'assessment.fields'),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  assessmentResponse: (row: DatabaseRow): AssessmentResponseDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    assessment_id: String(row['assessment_id']),
    entity_id: String(row['entity_id']),
    values: parseDatabaseJson(row['values'], {}, 'assessment_response.values'),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    updated_by: row['updated_by'] == null ? null : String(row['updated_by']),
    updated_by_name: row['updated_by_name'] == null ? null : String(row['updated_by_name'])
  })
};

// --

export type ProjectDatabase = {
  listProjects(ws: string): Promise<ProjectDbResult[]>;
  getProject(ws: string, identifier: string): Promise<ProjectDbResult | null>;
  createProject(input: ProjectDbCreate): Promise<ProjectDbResult>;
  updateProject(ws: string, id: string, input: ProjectDbUpdate): Promise<ProjectDbResult | null>;
  deleteProject(ws: string, id: string): Promise<void>;

  listContentNodes(ws: string, projectId: string): Promise<ContentNodeDbResult[]>;
  listAllContentNodes(ws: string): Promise<ContentNodeDbResult[]>;
  listEntityContentNodes(ws: string, entityId: string): Promise<ContentNodeDbResult[]>;
  listWorkspaceContentNodes(ws: string): Promise<ContentNodeDbResult[]>;
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
  listMarkdownRevisions(ws: string, nodeId: string): Promise<MarkdownRevisionDbResult[]>;
  getMarkdownRevision(ws: string, nodeId: string, revisionId: string): Promise<MarkdownRevisionDbResult | null>;
  createMarkdownRevision(input: MarkdownRevisionDbCreate): Promise<MarkdownRevisionDbResult>;
  getNextMarkdownRevisionNumber(ws: string, nodeId: string): Promise<number>;
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
  deleteWorkspaceContentNodeFolder(
    ws: string,
    folderPath: string
  ): Promise<ContentNodeDbResult[]>;

  listProjectEntities(ws: string, projectId: string): Promise<ProjectEntityDbResult[]>;
  listProjectEntityLinks(ws: string, projectId: string): Promise<ProjectEntityLinkDbResult[]>;
  addProjectEntity(input: ProjectEntityDbCreate): Promise<ProjectEntityDbResult>;
  updateProjectEntity(
    ws: string,
    projectId: string,
    entityId: string,
    entityTypeId: string | null,
    isDone: boolean
  ): Promise<ProjectEntityDbResult | null>;
  removeProjectEntity(ws: string, projectId: string, entityId: string): Promise<void>;
  getEntityProjects(ws: string, entityId: string): Promise<EntityProjectDbResult[]>;

  syncDiagramEntityRefs(ws: string, fileId: string, entityIds: string[]): Promise<void>;
  getEntityDiagramFiles(ws: string, entityId: string): Promise<DiagramEntityFileDbResult[]>;

  listAssessments(ws: string, projectId: string): Promise<AssessmentDbResult[]>;
  getAssessment(ws: string, projectId: string, id: string): Promise<AssessmentDbResult | null>;
  getAssessmentById(ws: string, id: string): Promise<AssessmentDbResult | null>;
  createAssessment(input: AssessmentDbCreate): Promise<AssessmentDbResult>;
  updateAssessment(
    ws: string,
    projectId: string,
    id: string,
    input: AssessmentDbUpdate
  ): Promise<AssessmentDbResult | null>;
  deleteAssessment(ws: string, projectId: string, id: string): Promise<AssessmentDbResult | null>;

  listAssessmentResponses(ws: string, assessmentId: string): Promise<AssessmentResponseDbResult[]>;
  getAssessmentResponse(
    ws: string,
    assessmentId: string,
    entityId: string
  ): Promise<AssessmentResponseDbResult | null>;
  upsertAssessmentResponse(input: AssessmentResponseDbUpsert): Promise<AssessmentResponseDbResult>;
  countAssessmentResponses(ws: string, assessmentId: string): Promise<number>;
};

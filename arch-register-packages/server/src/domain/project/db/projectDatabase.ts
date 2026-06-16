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
};

export type ContentNodeDbUpsert = {
  id?: string;
  workspace: string;
  project_id?: string | null;
  entity_id?: string | null;
  parent_id?: string | null;
  path: string;
  name: string;
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

export type ProjectEntityDbCreate = {
  workspace: string;
  project_id: string;
  entity_id: string;
  entity_type_id: string | null;
  is_done?: boolean;
  created_at: Date;
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
};

// --

export type ProjectDatabase = {
  listProjects(ws: string): Promise<ProjectDbResult[]>;
  getProject(ws: string, identifier: string): Promise<ProjectDbResult | null>;
  createProject(input: ProjectDbCreate): Promise<ProjectDbResult>;
  updateProject(ws: string, id: string, input: ProjectDbUpdate): Promise<ProjectDbResult | null>;
  deleteProject(ws: string, id: string): Promise<void>;

  listContentNodes(ws: string, projectId: string): Promise<ContentNodeDbResult[]>;
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
  addProjectEntity(input: ProjectEntityDbCreate): Promise<ProjectEntityDbResult>;
  updateProjectEntity(
    ws: string,
    projectId: string,
    entityId: string,
    entityTypeId: string | null,
    isDone: boolean
  ): Promise<ProjectEntityDbResult | null>;
  removeProjectEntity(ws: string, projectId: string, entityId: string): Promise<void>;
  getEntityProjects(ws: string, entityId: string): Promise<ProjectEntityDbResult[]>;

  syncDiagramEntityRefs(ws: string, fileId: string, entityIds: string[]): Promise<void>;
  getEntityDiagramFiles(ws: string, entityId: string): Promise<DiagramEntityFileDbResult[]>;
};

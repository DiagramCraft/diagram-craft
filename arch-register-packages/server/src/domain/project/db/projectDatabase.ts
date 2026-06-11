// -- Project File

export type ProjectFileDbResult = {
  id: string;
  workspace: string;
  project_id: string;
  path: string;
  name: string;
  size_bytes: number;
  comment_count: number;
  unresolved_comment_count: number;
  is_template: boolean;
  is_workspace_template: boolean;
  preview_svg: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ProjectFileDbUpsert = {
  workspace: string;
  project_id: string;
  path: string;
  name: string;
  size_bytes: number;
  comment_count: number;
  unresolved_comment_count: number;
  updated_at: Date;
  created_atIfNew: Date;
};

// -- Project

type BaseProject = {
  id: string;
  workspace: string;
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

// --

export type ProjectDatabase = {
  listProjects(ws: string): Promise<ProjectDbResult[]>;
  getProject(ws: string, id: string): Promise<ProjectDbResult | null>;
  createProject(input: ProjectDbCreate): Promise<ProjectDbResult>;
  updateProject(ws: string, id: string, input: ProjectDbUpdate): Promise<ProjectDbResult | null>;
  deleteProject(ws: string, id: string): Promise<void>;

  listProjectFiles(ws: string, projectId: string): Promise<ProjectFileDbResult[]>;
  getProjectFileByPath(
    ws: string,
    projectId: string,
    path: string
  ): Promise<ProjectFileDbResult | null>;
  updateProjectFileSizeById(
    ws: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ): Promise<void>;
  updateProjectFilePreview(
    ws: string,
    projectId: string,
    fileId: string,
    previewSvg: string | null
  ): Promise<void>;
  updateProjectFileDerivedData(
    ws: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    commentCount: number,
    unresolvedCommentCount: number,
    previewSvg: string | null,
    updated_at: Date
  ): Promise<void>;
  updateProjectFileTemplateStatus(
    ws: string,
    projectId: string,
    fileId: string,
    isTemplate: boolean,
    isWorkspaceTemplate: boolean,
    updated_at: Date
  ): Promise<void>;
  upsertProjectFile(input: ProjectFileDbUpsert): Promise<ProjectFileDbResult>;
  createProjectFileIfAbsent(input: ProjectFileDbUpsert): Promise<ProjectFileDbResult | null>;
  deleteProjectFileByPath(
    ws: string,
    projectId: string,
    path: string
  ): Promise<ProjectFileDbResult | null>;
  renameProjectFileFolder(
    ws: string,
    projectId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ): Promise<string[]>;
  deleteProjectFileFolder(
    ws: string,
    projectId: string,
    folderPath: string
  ): Promise<ProjectFileDbResult[]>;

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
};

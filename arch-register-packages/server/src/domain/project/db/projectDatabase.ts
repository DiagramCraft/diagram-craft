// -- Project File

export type ProjectFileRow = {
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

export type UpsertProjectFileInput = {
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

export type Project = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  owner: string | null;
  status: 'pinned' | 'active' | 'archived';
  color: string | null;
  created_at: Date;
  updated_at: Date;
};

// Project enriched with resolved names from joined tables (owner).
export type EnrichedProject = Project & {
  owner_name: string | null;
};

export type CreateProjectInput = Omit<Project, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateProjectInput = {
  name: string;
  description: string;
  owner: string | null;
  status: Project['status'];
  color: string | null;
  updated_at: Date;
};

export type ProjectDatabase = {
  listProjects(ws: string): Promise<EnrichedProject[]>;
  getProject(ws: string, id: string): Promise<EnrichedProject | null>;
  createProject(input: CreateProjectInput): Promise<EnrichedProject>;
  updateProject(ws: string, id: string, input: UpdateProjectInput): Promise<EnrichedProject | null>;
  deleteProject(ws: string, id: string): Promise<Project | null>;

  listProjectFiles(ws: string, projectId: string): Promise<ProjectFileRow[]>;
  getProjectFileByPath(ws: string, projectId: string, path: string): Promise<ProjectFileRow | null>;
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
  upsertProjectFile(input: UpsertProjectFileInput): Promise<ProjectFileRow>;
  createProjectFileIfAbsent(input: UpsertProjectFileInput): Promise<ProjectFileRow | null>;
  deleteProjectFileByPath(
    ws: string,
    projectId: string,
    path: string
  ): Promise<ProjectFileRow | null>;
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
  ): Promise<ProjectFileRow[]>;
};

import type {
  Project,
  ProjectFile
} from '../../../types';

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

export type ProjectDatabase = {
  listProjects(ws: string): Promise<Project[]>;
  getProject(ws: string, id: string): Promise<Project | null>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(ws: string, id: string, input: UpdateProjectInput): Promise<Project | null>;
  deleteProject(ws: string, id: string): Promise<Project | null>;

  listProjectFiles(ws: string, projectId: string): Promise<ProjectFile[]>;
  getProjectFileByPath(ws: string, projectId: string, path: string): Promise<ProjectFile | null>;
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
  upsertProjectFile(input: UpsertProjectFileInput): Promise<ProjectFile>;
  createProjectFileIfAbsent(
    input: Omit<UpsertProjectFileInput, 'updated_at'> & { updated_at: Date }
  ): Promise<ProjectFile | null>;
  deleteProjectFileByPath(ws: string, projectId: string, path: string): Promise<ProjectFile | null>;
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
  ): Promise<ProjectFile[]>;
};

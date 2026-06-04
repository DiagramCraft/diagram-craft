import type { ProjectCapabilities } from './common.js';

// ── Project Types ─────────────────────────────────────────────

export type Project = ProjectCapabilities & {
  id: string;
  workspace: string;
  name: string;
  description: string;
  owner: string | null;
  status: 'pinned' | 'active' | 'archived';
  color: string | null;
  file_count: number;
  created_at: string;
  updated_at: string;
};

// ── File Types ────────────────────────────────────────────────

export type ProjectFile = {
  id: string;
  project_id: string;
  path: string;
  name: string;
  size_bytes: number;
  comment_count?: number;
  unresolved_comment_count?: number;
  created_at: string;
  updated_at: string;
  is_template?: boolean;
  is_workspace_template?: boolean;
  preview_svg?: string | null;
};

export type FileFolder = {
  path: string;
  files: ProjectFile[];
};

export type FileTree = {
  folders: FileFolder[];
  rootFiles: ProjectFile[];
};

export type ProjectDetail = Project & {
  files: FileTree;
};

// ── Request Types ─────────────────────────────────────────────

export type CreateProjectRequest = {
  name: string;
  description?: string;
  owner?: string | null;
  status?: 'pinned' | 'active' | 'archived';
  color?: string | null;
};

export type UpdateProjectRequest = CreateProjectRequest;

export type CreateFolderRequest = {
  path: string;
};

export type CreateFolderResponse = {
  success: true;
  path: string;
  marker: ProjectFile | null;
};

export type RenameFolderRequest = {
  oldPath: string;
  newPath: string;
};

export type RenameFileRequest = {
  newName: string;
};

// ── Search Result ─────────────────────────────────────────────

export type ProjectSearchResult = {
  id: string;
  name: string;
  description: string;
  status: Project['status'];
};

export type ProjectFileSearchResult = {
  projectId: string;
  projectName: string;
  fileId: string;
  path: string;
  name: string;
};

// ── Template Types ────────────────────────────────────────────

export type ProjectTemplatesResponse = {
  workspaceTemplates: ProjectFile[];
  projectTemplates: ProjectFile[];
};

export type ToggleTemplateStatusRequest = {
  is_template: boolean;
  is_workspace_template: boolean;
};

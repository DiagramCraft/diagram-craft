import type { ProjectCapabilities } from './common.js';

// ── Project Types ─────────────────────────────────────────────

export type Project = ProjectCapabilities & {
  id: string;
  workspace: string;
  name: string;
  description: string;
  owner: string | null;
  status: 'pinned' | 'active' | 'archived';
  file_count: number;
  created_at: string;
  updated_at: string;
};

// ── File Types ────────────────────────────────────────────────

export type ProjectFile = {
  id: string;
  path: string;
  name: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
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

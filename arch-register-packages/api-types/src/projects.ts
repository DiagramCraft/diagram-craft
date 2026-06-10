import type { z } from 'zod';
import type {
  fileFolderSchema,
  fileTreeSchema,
  projectDetailSchema,
  projectFileSchema,
  projectSchema
} from './projectContract.js';

// ── Project Types ─────────────────────────────────────────────

export type Project = z.infer<typeof projectSchema>;

// ── File Types ────────────────────────────────────────────────

export type ProjectFile = z.infer<typeof projectFileSchema>;

export type FileFolder = z.infer<typeof fileFolderSchema>;

export type FileTree = z.infer<typeof fileTreeSchema>;

export type ProjectDetail = z.infer<typeof projectDetailSchema>;

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

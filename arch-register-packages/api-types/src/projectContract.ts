import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

const foreignKeySchema = z.object({
  id: z.string(),
  name: z.string()
});

const projectCapabilitiesSchema = z.object({
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canManageFiles: z.boolean()
});

const projectSchema = projectCapabilitiesSchema.extend({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  description: z.string(),
  owner: foreignKeySchema.nullable(),
  status: z.enum(['pinned', 'active', 'archived']),
  color: z.string().nullable(),
  file_count: z.number(),
  created_at: z.string(),
  updated_at: z.string()
});

const projectFileSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  path: z.string(),
  name: z.string(),
  size_bytes: z.number(),
  comment_count: z.number().optional(),
  unresolved_comment_count: z.number().optional(),
  is_template: z.boolean().optional(),
  is_workspace_template: z.boolean().optional(),
  preview_svg: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string()
});

const fileFolderSchema = z.object({
  path: z.string(),
  files: z.array(projectFileSchema)
});

const fileTreeSchema = z.object({
  folders: z.array(fileFolderSchema),
  rootFiles: z.array(projectFileSchema)
});

const projectDetailSchema = projectSchema.extend({
  files: fileTreeSchema
});

// ── Request schemas ───────────────────────────────────────────

export const listProjectsRequestSchema = z.object({
  workspace: z.string()
});

export const getProjectRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

export const createProjectRequestSchema = z.object({
  workspace: z.string(),
  name: z.string(),
  description: z.string().optional(),
  owner: z.string().nullable().optional(),
  status: z.enum(['pinned', 'active', 'archived']).optional(),
  color: z.string().nullable().optional()
});

export const updateProjectRequestSchema = z.object({
  workspace: z.string(),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  owner: z.string().nullable().optional(),
  status: z.enum(['pinned', 'active', 'archived']).optional(),
  color: z.string().nullable().optional()
});

export const deleteProjectRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

const deleteProjectResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export const listProjectFilesRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

// ── Contract ──────────────────────────────────────────────────

export const projectContract = {
  projects: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/projects' })
      .input(listProjectsRequestSchema)
      .output(z.array(projectSchema)),
    get: oc
      .route({ method: 'GET', path: '/{workspace}/projects/{id}' })
      .input(getProjectRequestSchema)
      .output(projectDetailSchema),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/projects' })
      .input(createProjectRequestSchema)
      .output(projectSchema),
    update: oc
      .route({ method: 'PUT', path: '/{workspace}/projects/{id}' })
      .input(updateProjectRequestSchema)
      .output(projectSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/projects/{id}' })
      .input(deleteProjectRequestSchema)
      .output(deleteProjectResponseSchema),
    listFiles: oc
      .route({ method: 'GET', path: '/{workspace}/projects/{id}/files' })
      .input(listProjectFilesRequestSchema)
      .output(fileTreeSchema)
  }
};

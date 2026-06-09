import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

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

// Response for GET /{workspace}/templates (all workspace templates, grouped by project)
const allTemplatesResponseSchema = z.object({
  workspaceTemplates: z.array(projectFileSchema),
  projectTemplates: z.record(z.string(), z.array(projectFileSchema))
});

// Response for GET /{workspace}/projects/{projectId}/templates (flat lists)
const projectTemplatesResponseSchema = z.object({
  workspaceTemplates: z.array(projectFileSchema),
  projectTemplates: z.array(projectFileSchema)
});

// ── Request schemas ───────────────────────────────────────────

export const listWorkspaceTemplatesRequestSchema = z.object({
  workspace: z.string()
});

export const listProjectTemplatesRequestSchema = z.object({
  workspace: z.string(),
  projectId: z.string()
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceTemplateContract = {
  templates: {
    listAll: oc
      .route({ method: 'GET', path: '/{workspace}/templates' })
      .input(listWorkspaceTemplatesRequestSchema)
      .output(allTemplatesResponseSchema),
    listForProject: oc
      .route({ method: 'GET', path: '/{workspace}/projects/{projectId}/templates' })
      .input(listProjectTemplatesRequestSchema)
      .output(projectTemplatesResponseSchema)
  }
};

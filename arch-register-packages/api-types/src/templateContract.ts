import { oc } from '@orpc/contract';
import { z } from 'zod';
import { projectFileSchema, ProjectFile } from '@arch-register/api-types/projectContract';
import { ws, wsAndId } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

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

// ── Contract ──────────────────────────────────────────────────

export const workspaceTemplateContract = {
  templates: {
    listAll: oc
      .route({ method: 'GET', path: '/{workspace}/templates', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(allTemplatesResponseSchema),
    listForProject: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/templates',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: wsAndId }))
      .output(projectTemplatesResponseSchema),
    toggleStatus: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/template-status/{path}',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: z.object({
            workspace: z.string(),
            id: z.string(),
            path: z.string()
          }),
          body: z.object({
            is_template: z.boolean(),
            is_workspace_template: z.boolean()
          })
        })
      )
      .output(projectFileSchema),
    createFromTemplate: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/from-template',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            name: z.string(),
            templateProjectId: z.string(),
            templatePath: z.string(),
            folder: z.string().nullable().optional()
          })
        })
      )
      .output(projectFileSchema)
  }
};

export type ProjectTemplatesResponse = {
  workspaceTemplates: ProjectFile[];
  projectTemplates: ProjectFile[];
};

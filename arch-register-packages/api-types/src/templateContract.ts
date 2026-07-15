import { oc } from '@orpc/contract';
import { z } from 'zod';
import { projectFileSchema, ProjectFile } from '@arch-register/api-types/projectContract';
import { ws, wsAndId } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

// Response for GET /{workspace}/templates (all workspace templates, grouped by project)
const allTemplatesResponseSchema = z.object({
  workspaceTemplates: z
    .array(projectFileSchema)
    .describe('Templates available across the entire workspace'),
  projectTemplates: z
    .record(z.string(), z.array(projectFileSchema))
    .describe('Templates organized by project ID')
});

// Response for GET /{workspace}/projects/{projectId}/templates (flat lists)
const projectTemplatesResponseSchema = z.object({
  workspaceTemplates: z
    .array(projectFileSchema)
    .describe('Workspace-level templates available to this project'),
  projectTemplates: z.array(projectFileSchema).describe('Project-specific templates')
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceTemplateContract = oc.tag('Templates').router({
  templates: {
    listAll: oc
      .route({
        method: 'GET',
        path: '/{workspace}/templates',
        inputStructure: 'detailed',
        summary: 'List all workspace templates',
        description:
          'Retrieves all diagram and file templates in the workspace, organized by project. Includes both workspace-level and project-specific templates.',
        tags: ['Templates']
      })
      .input(z.object({ params: ws }))
      .output(allTemplatesResponseSchema),
    listForProject: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/templates',
        inputStructure: 'detailed',
        summary: 'List templates for project',
        description:
          'Retrieves templates available for a specific project, including both workspace-level templates and project-specific templates.',
        tags: ['Templates']
      })
      .input(z.object({ params: wsAndId }))
      .output(projectTemplatesResponseSchema),
    toggleStatus: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/template-status/{path}',
        inputStructure: 'detailed',
        summary: 'Update template status',
        description:
          'Marks a file as a template or removes its template status. Can set as project-level or workspace-level template.',
        tags: ['Templates']
      })
      .input(
        z.object({
          params: z.object({
            workspace: z.string().describe('Workspace identifier'),
            id: z.string().describe('Project identifier'),
            path: z.string().describe('File path within the project')
          }),
          body: z.object({
            is_template: z
              .boolean()
              .describe('Whether the file should be marked as a project template'),
            is_workspace_template: z
              .boolean()
              .describe('Whether the file should be marked as a workspace-level template')
          })
        })
      )
      .output(projectFileSchema),
    createFromTemplate: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/from-template',
        inputStructure: 'detailed',
        summary: 'Create file from template',
        description:
          'Creates a new file in the project by copying from an existing template. The template can be from the same project or a workspace-level template.',
        tags: ['Templates']
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            name: z.string().describe('Name for the new file'),
            templateProjectId: z.string().describe('Project ID containing the template'),
            templatePath: z.string().describe('Path to the template file'),
            folder: z
              .string()
              .nullable()
              .optional()
              .describe('Optional folder path where the new file should be created')
          })
        })
      )
      .output(projectFileSchema)
  }
});

export type ProjectTemplatesResponse = {
  workspaceTemplates: ProjectFile[];
  projectTemplates: ProjectFile[];
};

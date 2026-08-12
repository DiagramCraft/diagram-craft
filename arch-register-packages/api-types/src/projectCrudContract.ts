import { oc } from '@orpc/contract';
import { z } from 'zod';
import { foreignKeySchema, ws, wsAndId } from '@arch-register/api-types/common';
import { fileTreeSchema } from './projectContentContract';

const projectCapabilitiesSchema = z.object({
  canEdit: z.boolean().describe('Whether the user can edit this project'),
  canDelete: z.boolean().describe('Whether the user can delete this project'),
  canManageFiles: z.boolean().describe('Whether the user can manage files in this project')
});

export const projectSchema = projectCapabilitiesSchema.extend({
  id: z.string().describe('Unique project identifier'),
  public_id: z.string().describe('Public project identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Project name'),
  description: z.string().describe('Project description'),
  owner: foreignKeySchema.nullable().describe('Project owner'),
  status: z.enum(['draft', 'active', 'complete', 'cancelled']).describe('Project status'),
  color: z.string().nullable().describe('Project color (hex format)'),
  start_date: z.string().nullable().describe('Start date (ISO 8601)'),
  target_date: z.string().nullable().describe('Target completion date (ISO 8601)'),
  pinned: z.boolean().describe('Whether the project is pinned'),
  file_count: z.number().describe('Number of files in the project'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

export const projectDetailSchema = projectSchema.extend({
  files: fileTreeSchema.describe('Project file tree')
});

export const deleteProjectResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

export const projectCrudContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/{workspace}/projects',
      inputStructure: 'detailed',
      summary: 'List projects',
      description: 'Retrieves all projects in the workspace with their metadata and file counts.',
      tags: ['Projects']
    })
    .input(z.object({ params: ws }))
    .output(z.array(projectSchema)),
  get: oc
    .route({
      method: 'GET',
      path: '/{workspace}/projects/{id}',
      inputStructure: 'detailed',
      summary: 'Get project details',
      description: 'Retrieves complete project details including the file tree structure.',
      tags: ['Projects']
    })
    .input(z.object({ params: wsAndId }))
    .output(projectDetailSchema),
  create: oc
    .route({
      method: 'POST',
      path: '/{workspace}/projects',
      inputStructure: 'detailed',
      summary: 'Create project',
      description: 'Creates a new project with the specified metadata.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws,
        body: z.object({
          name: z.string().describe('Project name'),
          description: z.preprocess(
            v => (v === undefined ? undefined : typeof v === 'string' ? v : ''),
            z.string().optional().describe('Project description')
          ),
          owner: z.string().nullable().optional().describe('Project owner identifier'),
          status: z
            .enum(['draft', 'active', 'complete', 'cancelled'])
            .optional()
            .describe('Project status'),
          color: z.preprocess(
            v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
            z.string().nullable().optional().describe('Project color (hex format)')
          ),
          start_date: z.string().nullable().optional().describe('Start date (ISO 8601)'),
          target_date: z
            .string()
            .nullable()
            .optional()
            .describe('Target completion date (ISO 8601)'),
          pinned: z.boolean().optional().describe('Whether to pin the project')
        })
      })
    )
    .output(projectSchema),
  update: oc
    .route({
      method: 'PUT',
      path: '/{workspace}/projects/{id}',
      inputStructure: 'detailed',
      summary: 'Update project',
      description: 'Updates project metadata. Only provided fields will be updated.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: wsAndId,
        body: z.object({
          name: z.string().describe('Project name'),
          description: z.string().optional().describe('Project description'),
          owner: z.string().nullable().optional().describe('Project owner identifier'),
          status: z
            .enum(['draft', 'active', 'complete', 'cancelled'])
            .optional()
            .describe('Project status'),
          color: z.string().nullable().optional().describe('Project color (hex format)'),
          start_date: z.string().nullable().optional().describe('Start date (ISO 8601)'),
          target_date: z
            .string()
            .nullable()
            .optional()
            .describe('Target completion date (ISO 8601)'),
          pinned: z.boolean().optional().describe('Whether the project is pinned')
        })
      })
    )
    .output(projectSchema),
  remove: oc
    .route({
      method: 'DELETE',
      path: '/{workspace}/projects/{id}',
      inputStructure: 'detailed',
      summary: 'Delete project',
      description:
        'Permanently deletes a project and all its files. This operation cannot be undone.',
      tags: ['Projects']
    })
    .input(z.object({ params: wsAndId }))
    .output(deleteProjectResponseSchema)
};

export type Project = z.infer<typeof projectSchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

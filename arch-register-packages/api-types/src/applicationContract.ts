import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';
import { dashboardSidebarConfigSchema } from '@arch-register/api-types/dashboardContract';

export const workspaceApplicationSchema = z.object({
  id: z.string().describe('Unique application identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  key: z.string().describe('URL-safe slug, unique within the workspace'),
  name: z.string().describe('Application name'),
  description: z.string().describe('Application description; empty when not set'),
  accentColor: z.string().nullable().describe('Accent color; null when not set'),
  order: z.number().int().describe('Position among the workspace applications, ascending'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp'),
  updatedBy: z
    .string()
    .nullable()
    .describe('Identifier of the user who last updated the application')
});

export type WorkspaceApplication = z.infer<typeof workspaceApplicationSchema>;

export const applicationDashboardSchema = z.object({
  id: z.string().describe('Dashboard identifier'),
  name: z.string().describe('Dashboard name'),
  icon: z.string().nullable().describe('Rail icon name; null when not set'),
  railLabel: z.string().nullable().describe('Rail label; null falls back to the name'),
  order: z.number().int().describe('Position within the application, ascending'),
  sidebar: dashboardSidebarConfigSchema.optional().describe('Primary sidebar configuration')
});

export const workspaceApplicationWithDashboardsSchema = workspaceApplicationSchema.extend({
  dashboards: z.array(applicationDashboardSchema).describe('Ordered dashboards of the application')
});

export type WorkspaceApplicationWithDashboards = z.infer<
  typeof workspaceApplicationWithDashboardsSchema
>;

export const createApplicationBodySchema = z.object({
  key: z.string().describe('URL-safe slug, unique within the workspace'),
  name: z.string().describe('Application name'),
  description: z.string().optional().describe('Application description'),
  accentColor: z.string().nullable().optional().describe('Accent color')
});

export type CreateApplicationRequest = z.infer<typeof createApplicationBodySchema>;

export const updateApplicationBodySchema = z.object({
  name: z.string().optional().describe('Application name'),
  description: z.string().optional().describe('Application description'),
  accentColor: z.string().nullable().optional().describe('Accent color')
});

export type UpdateApplicationRequest = z.infer<typeof updateApplicationBodySchema>;

export const reorderApplicationsBodySchema = z.object({
  ids: z.array(z.string()).describe('Every application id of the workspace, in the desired order')
});

export type ReorderApplicationsRequest = z.infer<typeof reorderApplicationsBodySchema>;

const deleteApplicationResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful')
});

export const workspaceApplicationContract = oc.tag('Application').router({
  workspaceApplications: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/workspace-applications',
        inputStructure: 'detailed',
        summary: 'List workspace applications',
        description:
          'Retrieves all applications of the workspace in display order, each with its ordered dashboards.',
        tags: ['Application']
      })
      .input(z.object({ params: ws }))
      .output(z.array(workspaceApplicationWithDashboardsSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/workspace-applications',
        inputStructure: 'detailed',
        summary: 'Create workspace application',
        description:
          'Creates an application together with its default Overview dashboard. The key must be a unique lowercase slug.',
        tags: ['Application']
      })
      .input(z.object({ params: ws, body: createApplicationBodySchema }))
      .output(workspaceApplicationSchema),
    reorder: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/workspace-applications/order',
        inputStructure: 'detailed',
        summary: 'Reorder workspace applications',
        description: 'Sets the display order; the body must list every application exactly once.',
        tags: ['Application']
      })
      .input(z.object({ params: ws, body: reorderApplicationsBodySchema }))
      .output(z.array(workspaceApplicationSchema)),
    update: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/workspace-applications/{id}',
        inputStructure: 'detailed',
        summary: 'Update workspace application',
        description: 'Renames or recolors an application. Only provided fields are updated.',
        tags: ['Application']
      })
      .input(z.object({ params: wsAndUUID, body: updateApplicationBodySchema }))
      .output(workspaceApplicationSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/workspace-applications/{id}',
        inputStructure: 'detailed',
        summary: 'Delete workspace application',
        description: 'Deletes an application together with its dashboards and its access policy.',
        tags: ['Application']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(deleteApplicationResponseSchema)
  }
});

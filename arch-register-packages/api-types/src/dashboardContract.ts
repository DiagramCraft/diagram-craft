import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID, wsAndProjectId } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

export const dashboardWidgetTypeSchema = z.string().describe('Extensible widget type identifier');

const gridPositionShape = {
  id: z.string().describe('Unique widget identifier'),
  x: z.number().int().describe('Grid column position'),
  y: z.number().int().describe('Grid row position'),
  w: z.number().int().describe('Grid width in columns'),
  h: z.number().int().describe('Grid height in rows')
};

export const dashboardWidgetSchema = z.object({
  ...gridPositionShape,
  type: dashboardWidgetTypeSchema,
  config: z
    .record(z.string(), z.unknown())
    .describe('Widget-specific configuration; interpreted by the widget implementation')
});

export const workspaceDashboardSchema = z.object({
  id: z.string().describe('Unique dashboard identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Dashboard name'),
  order: z
    .number()
    .int()
    .describe(
      'Position among the workspace dashboards, ascending; the lowest is shown at the workspace home'
    ),
  widgets: z.array(dashboardWidgetSchema).describe('Dashboard widget layout'),
  updatedAt: z.string().nullable().describe('ISO 8601 last update timestamp'),
  updatedBy: z.string().nullable().describe('Identifier of the user who last updated the layout')
});

// ── Request schemas ───────────────────────────────────────────

export const createDashboardBodySchema = z.object({
  name: z.string().describe('Dashboard name')
});

export const updateDashboardBodySchema = z.object({
  name: z.string().optional().describe('Dashboard name'),
  widgets: z.array(dashboardWidgetSchema).optional().describe('Dashboard widget layout to persist')
});

const deleteDashboardResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful')
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceDashboardContract = oc.tag('Dashboard').router({
  dashboards: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/dashboards',
        inputStructure: 'detailed',
        summary: 'List workspace dashboards',
        description:
          'Retrieves all dashboards for the workspace. A fresh workspace has a single seeded default dashboard.',
        tags: ['Dashboard']
      })
      .input(z.object({ params: ws }))
      .output(z.array(workspaceDashboardSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/dashboards',
        inputStructure: 'detailed',
        summary: 'Create workspace dashboard',
        description: 'Creates a new, empty dashboard for the workspace.',
        tags: ['Dashboard']
      })
      .input(z.object({ params: ws, body: createDashboardBodySchema }))
      .output(workspaceDashboardSchema),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/dashboards/{id}',
        inputStructure: 'detailed',
        summary: 'Get workspace dashboard',
        description: 'Retrieves a single dashboard by id.',
        tags: ['Dashboard']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(workspaceDashboardSchema),
    update: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/dashboards/{id}',
        inputStructure: 'detailed',
        summary: 'Update workspace dashboard',
        description:
          'Updates an existing dashboard. Only provided fields will be updated; widgets, when provided, wholesale replace the existing layout.',
        tags: ['Dashboard']
      })
      .input(z.object({ params: wsAndUUID, body: updateDashboardBodySchema }))
      .output(workspaceDashboardSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/dashboards/{id}',
        inputStructure: 'detailed',
        summary: 'Delete workspace dashboard',
        description:
          'Deletes a dashboard. A workspace must always have at least one dashboard; deleting the last remaining dashboard is rejected. Deleting the default dashboard promotes another dashboard to default.',
        tags: ['Dashboard']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(deleteDashboardResponseSchema)
  }
});

export type DashboardWidgetType = z.infer<typeof dashboardWidgetTypeSchema>;

export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

export type WorkspaceDashboard = z.infer<typeof workspaceDashboardSchema>;

export type CreateDashboardRequest = z.infer<typeof createDashboardBodySchema>;

export type UpdateDashboardRequest = z.infer<typeof updateDashboardBodySchema>;

// ── Personal dashboards ───────────────────────────────────────

export const personalDashboardSchema = z.object({
  id: z.string().describe('Unique dashboard identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Dashboard name'),
  order: z.number().int().describe('Position among the caller’s personal dashboards, ascending'),
  widgets: z.array(dashboardWidgetSchema).describe('Dashboard widget layout'),
  updatedAt: z.string().nullable().describe('ISO 8601 last update timestamp')
});

const deletePersonalDashboardResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful')
});

export const personalDashboardContract = oc.tag('PersonalDashboard').router({
  personalDashboards: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/personal-dashboards',
        inputStructure: 'detailed',
        summary: 'List personal dashboards',
        description:
          'Retrieves the caller’s personal dashboards for the workspace. Returns an empty array if the caller has not created any.',
        tags: ['PersonalDashboard']
      })
      .input(z.object({ params: ws }))
      .output(z.array(personalDashboardSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/personal-dashboards',
        inputStructure: 'detailed',
        summary: 'Create personal dashboard',
        description: 'Creates a new, empty personal dashboard for the caller in this workspace.',
        tags: ['PersonalDashboard']
      })
      .input(z.object({ params: ws, body: createDashboardBodySchema }))
      .output(personalDashboardSchema),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/personal-dashboards/{id}',
        inputStructure: 'detailed',
        summary: 'Get personal dashboard',
        description: 'Retrieves a single personal dashboard owned by the caller by id.',
        tags: ['PersonalDashboard']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(personalDashboardSchema),
    update: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/personal-dashboards/{id}',
        inputStructure: 'detailed',
        summary: 'Update personal dashboard',
        description:
          'Updates an existing personal dashboard owned by the caller. Only provided fields will be updated; widgets, when provided, wholesale replace the existing layout.',
        tags: ['PersonalDashboard']
      })
      .input(z.object({ params: wsAndUUID, body: updateDashboardBodySchema }))
      .output(personalDashboardSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/personal-dashboards/{id}',
        inputStructure: 'detailed',
        summary: 'Delete personal dashboard',
        description:
          'Deletes a personal dashboard owned by the caller. Unlike workspace dashboards, deleting the last remaining personal dashboard is allowed.',
        tags: ['PersonalDashboard']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(deletePersonalDashboardResponseSchema)
  }
});

export type PersonalDashboard = z.infer<typeof personalDashboardSchema>;

// ── Project dashboards ────────────────────────────────────────

export const projectDashboardSchema = z.object({
  id: z.string().describe('Unique dashboard identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  projectId: z.string().describe('Parent project identifier'),
  widgets: z.array(dashboardWidgetSchema).describe('Dashboard widget layout'),
  updatedAt: z.string().nullable().describe('ISO 8601 last update timestamp'),
  updatedBy: z.string().nullable().describe('Identifier of the user who last updated the layout')
});

export const updateProjectDashboardBodySchema = z.object({
  widgets: z.array(dashboardWidgetSchema).describe('Dashboard widget layout to persist')
});

export const projectDashboardContract = oc.tag('ProjectDashboard').router({
  projectDashboard: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{projectId}/dashboard',
        inputStructure: 'detailed',
        summary: 'Get project dashboard',
        description:
          'Retrieves the dashboard for the project. A project without a saved dashboard yet is seeded with a default one on first read.',
        tags: ['ProjectDashboard']
      })
      .input(z.object({ params: wsAndProjectId }))
      .output(projectDashboardSchema),
    update: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/projects/{projectId}/dashboard',
        inputStructure: 'detailed',
        summary: 'Update project dashboard',
        description:
          'Updates the project dashboard. Widgets wholesale-replace the existing layout.',
        tags: ['ProjectDashboard']
      })
      .input(z.object({ params: wsAndProjectId, body: updateProjectDashboardBodySchema }))
      .output(projectDashboardSchema)
  }
});

export type ProjectDashboard = z.infer<typeof projectDashboardSchema>;

export type UpdateProjectDashboardRequest = z.infer<typeof updateProjectDashboardBodySchema>;

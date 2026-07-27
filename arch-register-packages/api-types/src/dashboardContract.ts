import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

export const dashboardWidgetTypeSchema = z.enum([
  'stat-metric',
  'saved-view-embed',
  'entity-table',
  'lifecycle-chart',
  'activity-trend-chart',
  'stale-entity-report',
  'activity-feed'
]);

const gridPositionShape = {
  id: z.string().describe('Unique widget identifier'),
  x: z.number().int().describe('Grid column position'),
  y: z.number().int().describe('Grid row position'),
  w: z.number().int().describe('Grid width in columns'),
  h: z.number().int().describe('Grid height in rows')
};

export const statMetricWidgetSchema = z.object({
  ...gridPositionShape,
  type: z.literal('stat-metric'),
  metricType: z.enum(['entity-count', 'project-count', 'diagram-count', 'completeness-percent']),
  schema: z.string().optional().describe('Optional schema identifier to scope the metric'),
  owner: z.string().optional().describe('Optional owner identifier to scope the metric'),
  lifecycle: z.string().optional().describe('Optional lifecycle state to scope the metric'),
  label: z.string().optional().describe('Optional display label override')
});

export const savedViewEmbedWidgetSchema = z.object({
  ...gridPositionShape,
  type: z.literal('saved-view-embed'),
  viewId: z.string().describe('Identifier of the saved view to embed')
});

export const entityTableWidgetSchema = z.object({
  ...gridPositionShape,
  type: z.literal('entity-table'),
  schema: z.string().optional().describe('Optional schema identifier to scope the table'),
  owner: z.string().optional().describe('Optional owner identifier to scope the table'),
  lifecycle: z.string().optional().describe('Optional lifecycle state to scope the table'),
  limit: z.number().int().optional().describe('Maximum number of entities to display')
});

export const lifecycleChartWidgetSchema = z.object({
  ...gridPositionShape,
  type: z.literal('lifecycle-chart')
});

export const activityTrendChartWidgetSchema = z.object({
  ...gridPositionShape,
  type: z.literal('activity-trend-chart'),
  lookbackDays: z.number().int().optional().describe('Number of days to look back')
});

export const staleEntityReportWidgetSchema = z.object({
  ...gridPositionShape,
  type: z.literal('stale-entity-report'),
  staleAfterDays: z
    .number()
    .int()
    .optional()
    .describe('Number of days without update before an entity is considered stale')
});

export const activityFeedWidgetSchema = z.object({
  ...gridPositionShape,
  type: z.literal('activity-feed'),
  limit: z.number().int().optional().describe('Maximum number of activity items to display')
});

export const dashboardWidgetSchema = z.discriminatedUnion('type', [
  statMetricWidgetSchema,
  savedViewEmbedWidgetSchema,
  entityTableWidgetSchema,
  lifecycleChartWidgetSchema,
  activityTrendChartWidgetSchema,
  staleEntityReportWidgetSchema,
  activityFeedWidgetSchema
]);

export const workspaceDashboardSchema = z.object({
  workspaceId: z.string().describe('Parent workspace identifier'),
  widgets: z.array(dashboardWidgetSchema).describe('Dashboard widget layout'),
  updatedAt: z.string().nullable().describe('ISO 8601 last update timestamp'),
  updatedBy: z.string().nullable().describe('Identifier of the user who last updated the layout')
});

// ── Request schemas ───────────────────────────────────────────

export const putDashboardBodySchema = z.object({
  widgets: z.array(dashboardWidgetSchema).describe('Dashboard widget layout to persist')
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceDashboardContract = oc.tag('Dashboard').router({
  dashboard: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/dashboard',
        inputStructure: 'detailed',
        summary: 'Get workspace dashboard',
        description:
          'Retrieves the workspace dashboard layout. Returns an empty widget list if no dashboard has been configured yet.',
        tags: ['Dashboard']
      })
      .input(z.object({ params: ws }))
      .output(workspaceDashboardSchema),
    put: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/dashboard',
        inputStructure: 'detailed',
        summary: 'Replace workspace dashboard',
        description:
          'Replaces the entire workspace dashboard layout with the provided widgets. This operation is a wholesale replacement, not a merge.',
        tags: ['Dashboard']
      })
      .input(z.object({ params: ws, body: putDashboardBodySchema }))
      .output(workspaceDashboardSchema)
  }
});

export type DashboardWidgetType = z.infer<typeof dashboardWidgetTypeSchema>;

export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

export type WorkspaceDashboard = z.infer<typeof workspaceDashboardSchema>;

export type PutDashboardRequest = z.infer<typeof putDashboardBodySchema>;

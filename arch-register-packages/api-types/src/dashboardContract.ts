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

const dashboardSidebarSchemaNameSchema = z
  .string()
  .describe(
    "Entity schema display name to list in the picker, matched at render time — the schema's actual id is often workspace-configurable, so it cannot be seeded as a fixed id (mirrors AggregateStat widget configs referencing schemas by name in query strings)"
  );

const dashboardSidebarVariableNameSchema = z
  .string()
  .describe(
    'Exposed as $<variableName> for substitution into widget config string values (see resolveSidebarVariableReferences)'
  );

export const dashboardFacetConfigSchema = z.object({
  fieldId: z
    .string()
    .describe(
      "Field to facet on: either a reference, select or text field's display NAME on the faceted schema (matched " +
        "at render time, like `schemaName` — a schema's actual field ids are workspace-specific, " +
        "resolved via capability field-role binding, so they can't be seeded as fixed ids; its " +
        "counts are tallied against the referenced schema's entities; select facets use the " +
        "field's options as labels, text facets the distinct values), or one of the stable " +
        "standard fields '_owner' / '_lifecycle'"
    ),
  variableName: dashboardSidebarVariableNameSchema.describe(
    'Exposed as $<variableName>, holding a comma-joined list of the selected ids (multi-select, ' +
      "unlike entity-picker's single id) for substitution into widget config string values " +
      '(see resolveSidebarVariableReferences)'
  ),
  itemLabel: z.string().optional().describe("Group label shown above this facet's list")
});

export const dashboardSidebarOptionSchema = z.object({
  value: z
    .string()
    .min(1)
    .describe('Value exposed as $<variableName> when this option is selected'),
  label: z.string().describe('Label shown for this option in the sidebar')
});

export const dashboardSidebarConfigSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('entity-picker').describe('Single-select list of one schema’s entities'),
    schemaName: dashboardSidebarSchemaNameSchema,
    variableName: dashboardSidebarVariableNameSchema,
    itemLabel: z.string().optional().describe('Group label shown above the picker list'),
    valueKind: z
      .enum(['publicId', 'id'])
      .optional()
      .describe(
        "Which identifier the selection exposes as $<variableName>: the entity's public id " +
          "(default) or its internal id, which is what a query's '_id' predicate matches"
      )
  }),
  z.object({
    kind: z
      .literal('facets')
      .describe('One or more independent multi-select facet lists over one schema’s entities'),
    schemaName: dashboardSidebarSchemaNameSchema.describe(
      'Schema display name whose records are being faceted: an entity schema, or a relation ' +
        "schema when `schemaKind` is 'relation'"
    ),
    schemaKind: z
      .enum(['entity', 'relation'])
      .optional()
      .describe(
        'Whether `schemaName` names an entity schema (default) or a relation schema, in which case ' +
          "facets are tallied over the relation's own select/text fields and '_owner' / '_lifecycle'"
      ),
    facets: z
      .array(dashboardFacetConfigSchema)
      .min(1)
      .describe('Facet sections to render, each its own labeled multi-select list')
  }),
  z.object({
    kind: z
      .literal('options')
      .describe('Single-select list of fixed value/label pairs (no counts, no entity lookup)'),
    variableName: dashboardSidebarVariableNameSchema.describe(
      'Exposed as $<variableName>, holding the selected option value, or an empty string when ' +
        'nothing is selected, for substitution into widget config string values (see ' +
        'resolveSidebarVariableReferences)'
    ),
    itemLabel: z.string().optional().describe('Group label shown above the options list'),
    allLabel: z
      .string()
      .optional()
      .describe(
        'When set, a first row with this label is shown that is active while nothing is selected ' +
          'and clears the selection when clicked'
      ),
    options: z
      .array(dashboardSidebarOptionSchema)
      .min(1)
      .describe('Fixed options to choose between; re-selecting the active one clears it')
  })
]);

export const workspaceDashboardSchema = z.object({
  id: z.string().describe('Unique dashboard identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Dashboard name'),
  description: z.string().describe('Dashboard description; empty when not set'),
  order: z
    .number()
    .int()
    .describe(
      'Position among the workspace dashboards, ascending; the lowest is shown at the workspace home'
    ),
  widgets: z.array(dashboardWidgetSchema).describe('Dashboard widget layout'),
  updatedAt: z.string().nullable().describe('ISO 8601 last update timestamp'),
  updatedBy: z.string().nullable().describe('Identifier of the user who last updated the layout'),
  appKey: z
    .string()
    .nullable()
    .optional()
    .describe('Set when the dashboard belongs to an app rather than the workspace home'),
  applicationId: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Identifier of the application that owns the dashboard; null for workspace dashboards'
    ),
  applicationOrder: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe(
      'Position among the application dashboards, ascending; null for workspace dashboards'
    ),
  icon: z
    .string()
    .nullable()
    .optional()
    .describe('Icon name shown for the dashboard in the app rail'),
  railLabel: z
    .string()
    .nullable()
    .optional()
    .describe('Label shown for the dashboard in the app rail'),
  sidebar: dashboardSidebarConfigSchema
    .optional()
    .describe('Optional selection sidebar whose current selection can drive widget config')
});

// ── Request schemas ───────────────────────────────────────────

export const createDashboardBodySchema = z.object({
  name: z.string().describe('Dashboard name'),
  description: z.string().optional().describe('Dashboard description')
});

export const updateDashboardBodySchema = z.object({
  name: z.string().optional().describe('Dashboard name'),
  description: z.string().optional().describe('Dashboard description'),
  widgets: z.array(dashboardWidgetSchema).optional().describe('Dashboard widget layout to persist'),
  sidebar: dashboardSidebarConfigSchema
    .nullable()
    .optional()
    .describe('Selection sidebar to persist; omit to leave unchanged, null to remove it')
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
    getApp: oc
      .route({
        method: 'GET',
        path: '/{workspace}/app-dashboards/{appKey}',
        inputStructure: 'detailed',
        summary: 'Get app dashboard',
        description:
          'Retrieves the dashboard backing an app section. App dashboards are not part of the workspace home dashboard list and are updated through the regular dashboard update endpoint.',
        tags: ['Dashboard']
      })
      .input(z.object({ params: ws.extend({ appKey: z.string() }) }))
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

export type DashboardSidebarConfig = z.infer<typeof dashboardSidebarConfigSchema>;

export type DashboardSidebarOption = z.infer<typeof dashboardSidebarOptionSchema>;
export type DashboardFacetConfig = z.infer<typeof dashboardFacetConfigSchema>;

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

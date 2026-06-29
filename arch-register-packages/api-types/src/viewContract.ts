import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

export const browserViewSchema = z.enum([
  'table',
  'cards',
  'tree',
  'radar',
  'timeline',
  'matrix',
  'hierarchy',
  'explore'
]).describe('Available view modes for displaying entities');

export const filterConditionSchema = z.object({
  fieldId: z.string().describe('Field identifier to filter on'),
  op: z.enum([
    'equals',
    'not_equals',
    'contains',
    'starts_with',
    'ends_with',
    'empty',
    'not_empty',
    'before',
    'after',
    'on',
    'gt',
    'lt'
  ]).describe('Filter operation'),
  value: z.unknown().describe('Filter value (type depends on field and operation)')
});

export const entityFiltersSchema = z.object({
  schemaId: z.string().nullable().optional().describe('Filter by schema identifier'),
  status: z.string().nullable().optional().describe('Filter by lifecycle status'),
  owner: z.string().nullable().optional().describe('Filter by owner identifier'),
  q: z.string().optional().describe('Search query string'),
  dateFilterField: z.string().optional().describe('Field identifier for date filtering'),
  dateFilterOperator: z.enum(['on', 'before', 'after', 'empty']).optional().describe('Date filter operation'),
  dateFilterValue: z.string().optional().describe('Date filter value (ISO 8601)'),
  sort: z.string().optional().describe('Sort field and direction (e.g., "name:asc")'),
  conditions: z.array(filterConditionSchema).optional().describe('Additional filter conditions')
});

export const radarViewConfigSchema = z.object({
  schemaId: z.string().describe('Schema identifier for radar view'),
  quadrantFieldId: z.string().describe('Field identifier for quadrant positioning'),
  ringFieldId: z.string().describe('Field identifier for ring positioning'),
  ringOrder: z.array(z.string()).describe('Ordered list of ring values from center to outer')
});

export const timelineViewConfigSchema = z.object({
  startFieldId: z.string().nullable().describe('Field identifier for timeline start date'),
  endFieldId: z.string().nullable().describe('Field identifier for timeline end date'),
  groupBy: z.enum(['owner', 'type', 'snapshot']).describe('Timeline grouping mode'),
  zoom: z.enum(['month', 'quarter', 'year']).describe('Timeline zoom level')
});

export const matrixViewConfigSchema = z.object({
  colMode: z.enum(['entity', 'attribute']).describe('Column mode (entities or attributes)'),
  colSchemaId: z.string().nullable().describe('Schema identifier for column entities'),
  colEnumFieldId: z.string().nullable().describe('Enum field identifier for attribute columns'),
  filterFieldName: z.string().nullable().describe('Field name for filtering relationships'),
  hideEmptyRows: z.boolean().describe('Whether to hide rows with no relationships'),
  hideEmptyCols: z.boolean().describe('Whether to hide columns with no relationships')
});

export const hierarchyViewConfigSchema = z.object({
  levels: z.number().int().min(1).max(3).describe('Number of hierarchy levels (1-3)'),
  level1SchemaId: z.string().nullable().describe('Schema identifier for level 1'),
  level1Columns: z.number().int().min(1).max(4).describe('Number of columns for level 1 (1-4)'),
  level2SchemaId: z.string().nullable().optional().describe('Schema identifier for level 2'),
  level2Columns: z.number().int().min(1).max(4).optional().describe('Number of columns for level 2 (1-4)'),
  level3SchemaId: z.string().nullable().optional().describe('Schema identifier for level 3'),
  level3Columns: z.number().int().min(1).max(4).optional().describe('Number of columns for level 3 (1-4)')
});

export const exploreViewConfigSchema = z.object({
  leftDepth: z.number().int().min(0).describe('Depth of relationships to explore on the left'),
  rightDepth: z.number().int().min(0).describe('Depth of relationships to explore on the right'),
  relationFieldNames: z.array(z.string()).describe('Relationship field names to include')
});

const viewConfigSchema = z
  .object({
    radar: radarViewConfigSchema.optional().describe('Configuration for radar view'),
    timeline: timelineViewConfigSchema.optional().describe('Configuration for timeline view'),
    matrix: matrixViewConfigSchema.optional().describe('Configuration for matrix view'),
    hierarchy: hierarchyViewConfigSchema.optional().describe('Configuration for hierarchy view'),
    explore: exploreViewConfigSchema.optional().describe('Configuration for explore view')
  })
  .nullable()
  .describe('View-specific configuration (only one view type should be configured)');

export const savedViewSchema = z.object({
  id: z.string().describe('Unique view identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('View name'),
  description: z.string().nullable().describe('View description'),
  viewMode: browserViewSchema.describe('View display mode'),
  filters: entityFiltersSchema.describe('Entity filters applied in this view'),
  config: viewConfigSchema.describe('View-specific configuration'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp')
});

export const pinnedEntitySchema = z.object({
  entity_id: z.string().describe('Entity identifier'),
  entity_public_id: z.string().describe('Public entity identifier'),
  entity_name: z.string().describe('Entity name'),
  entity_slug: z.string().describe('Entity URL slug'),
  schema_id: z.string().describe('Schema identifier'),
  created_at: z.string().describe('ISO 8601 timestamp when entity was pinned')
});

// ── Request schemas ───────────────────────────────────────────

export const createViewBodySchema = z.object({
  name: z.string().describe('View name'),
  description: z.string().nullable().optional().describe('View description'),
  viewMode: browserViewSchema.describe('View display mode'),
  filters: entityFiltersSchema.describe('Entity filters to apply'),
  config: viewConfigSchema.optional().describe('View-specific configuration')
});

export const updateViewBodySchema = z.object({
  name: z.string().optional().describe('View name'),
  description: z.string().nullable().optional().describe('View description'),
  viewMode: browserViewSchema.optional().describe('View display mode'),
  filters: entityFiltersSchema.optional().describe('Entity filters to apply'),
  config: viewConfigSchema.optional().describe('View-specific configuration')
});

export const getViewRequestSchema = z.object({
  workspace: z.string().describe('Workspace identifier'),
  id: z.string().describe('View identifier')
});

const deleteViewResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful')
});

const deletePinnedEntityResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message')
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceViewContract = oc
  .tag('Views')
  .router({
    views: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/views',
          inputStructure: 'detailed',
          summary: 'List saved views',
          description: 'Retrieves all saved views for the workspace. Views define custom filters and display configurations for browsing entities.',
          tags: ['Views']
        })
        .input(
          z.object({
            params: ws
          })
        )
        .output(z.array(savedViewSchema)),
      create: oc
        .route({
          method: 'POST',
          path: '/{workspace}/views',
          inputStructure: 'detailed',
          summary: 'Create saved view',
          description: 'Creates a new saved view with the specified filters and configuration. Views can use different display modes like table, cards, radar, timeline, etc.',
          tags: ['Views']
        })
        .input(
          z.object({
            params: ws,
            body: createViewBodySchema
          })
        )
        .output(savedViewSchema),
      update: oc
        .route({
          method: 'PATCH',
          path: '/{workspace}/views/{id}',
          inputStructure: 'detailed',
          summary: 'Update saved view',
          description: 'Updates an existing saved view. Only provided fields will be updated.',
          tags: ['Views']
        })
        .input(
          z.object({
            params: wsAndUUID,
            body: updateViewBodySchema
          })
        )
        .output(savedViewSchema),
      remove: oc
        .route({
          method: 'DELETE',
          path: '/{workspace}/views/{id}',
          inputStructure: 'detailed',
          summary: 'Delete saved view',
          description: 'Deletes a saved view. This operation cannot be undone.',
          tags: ['Views']
        })
        .input(
          z.object({
            params: wsAndUUID
          })
        )
        .output(deleteViewResponseSchema)
    },
    pinnedEntities: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/pinned-entities',
          inputStructure: 'detailed',
          summary: 'List pinned entities',
          description: 'Retrieves all entities pinned by the current user for quick access.',
          tags: ['Views']
        })
        .input(
          z.object({
            params: ws
          })
        )
        .output(z.array(pinnedEntitySchema)),
      create: oc
        .route({
          method: 'POST',
          path: '/{workspace}/pinned-entities',
          inputStructure: 'detailed',
          summary: 'Pin an entity',
          description: 'Pins an entity for quick access. Pinned entities appear in the user\'s favorites list.',
          tags: ['Views']
        })
        .input(
          z.object({
            params: ws,
            body: z.object({ entity_id: z.string().describe('Entity identifier to pin') })
          })
        )
        .output(pinnedEntitySchema),
      remove: oc
        .route({
          method: 'DELETE',
          path: '/{workspace}/pinned-entities/{id}',
          inputStructure: 'detailed',
          summary: 'Unpin an entity',
          description: 'Removes an entity from the user\'s pinned list.',
          tags: ['Views']
        })
        .input(
          z.object({
            params: wsAndUUID
          })
        )
        .output(deletePinnedEntityResponseSchema)
    }
  });

export type BrowserView = z.infer<typeof browserViewSchema>;

export type FilterCondition = z.infer<typeof filterConditionSchema>;

export type EntityFilters = z.infer<typeof entityFiltersSchema>;

export type RadarViewConfig = z.infer<typeof radarViewConfigSchema>;

export type TimelineViewConfig = z.infer<typeof timelineViewConfigSchema>;

export type MatrixViewConfig = z.infer<typeof matrixViewConfigSchema>;

export type HierarchyViewConfig = z.infer<typeof hierarchyViewConfigSchema>;

export type ExploreViewConfig = z.infer<typeof exploreViewConfigSchema>;

export type SavedView = z.infer<typeof savedViewSchema>;

export type CreateSavedViewRequest = z.infer<typeof createViewBodySchema>;

export type UpdateSavedViewRequest = z.infer<typeof updateViewBodySchema>;
import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

const browserViewSchema = z.enum(['table', 'cards', 'tree', 'radar', 'timeline']);

const filterConditionSchema = z.object({
  fieldId: z.string(),
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
  ]),
  value: z.unknown()
});

const entityFiltersSchema = z.object({
  schemaId: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  q: z.string().optional(),
  dateFilterField: z.string().optional(),
  dateFilterOperator: z.enum(['on', 'before', 'after', 'empty']).optional(),
  dateFilterValue: z.string().optional(),
  sort: z.string().optional(),
  conditions: z.array(filterConditionSchema).optional()
});

const radarViewConfigSchema = z.object({
  schemaId: z.string(),
  quadrantFieldId: z.string(),
  ringFieldId: z.string(),
  ringOrder: z.array(z.string())
});

const timelineViewConfigSchema = z.object({
  startFieldId: z.string().nullable(),
  endFieldId: z.string().nullable(),
  groupBy: z.enum(['owner', 'type']),
  zoom: z.enum(['month', 'quarter', 'year'])
});

const viewConfigSchema = z
  .object({
    radar: radarViewConfigSchema.optional(),
    timeline: timelineViewConfigSchema.optional()
  })
  .nullable();

const savedViewSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  viewMode: browserViewSchema,
  filters: entityFiltersSchema,
  config: viewConfigSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

const pinnedEntitySchema = z.object({
  entity_id: z.string(),
  entity_name: z.string(),
  entity_slug: z.string(),
  schema_id: z.string(),
  created_at: z.string()
});

// ── Request schemas ───────────────────────────────────────────

export const listViewsRequestSchema = z.object({
  workspace: z.string()
});

const createViewBodySchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  viewMode: browserViewSchema,
  filters: entityFiltersSchema,
  config: viewConfigSchema.optional()
});

export const createViewRequestSchema = createViewBodySchema.extend({
  workspace: z.string()
});

const updateViewBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  viewMode: browserViewSchema.optional(),
  filters: entityFiltersSchema.optional(),
  config: viewConfigSchema.optional()
});

export const updateViewRequestSchema = updateViewBodySchema.extend({
  workspace: z.string(),
  id: z.string()
});

export const getViewRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

export const deleteViewRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

const deleteViewResponseSchema = z.object({ success: z.boolean() });

export const listPinnedEntitiesRequestSchema = z.object({
  workspace: z.string()
});

export const createPinnedEntityRequestSchema = z.object({
  workspace: z.string(),
  entity_id: z.string()
});

export const deletePinnedEntityRequestSchema = z.object({
  workspace: z.string(),
  entityId: z.string()
});

const deletePinnedEntityResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceViewContract = {
  views: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/views' })
      .input(listViewsRequestSchema)
      .output(z.array(savedViewSchema)),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/views' })
      .input(createViewRequestSchema)
      .output(savedViewSchema),
    update: oc
      .route({ method: 'PATCH', path: '/{workspace}/views/{id}' })
      .input(updateViewRequestSchema)
      .output(savedViewSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/views/{id}' })
      .input(deleteViewRequestSchema)
      .output(deleteViewResponseSchema)
  },
  pinnedEntities: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/pinned-entities' })
      .input(listPinnedEntitiesRequestSchema)
      .output(z.array(pinnedEntitySchema)),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/pinned-entities' })
      .input(createPinnedEntityRequestSchema)
      .output(pinnedEntitySchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/pinned-entities/{entityId}' })
      .input(deletePinnedEntityRequestSchema)
      .output(deletePinnedEntityResponseSchema)
  }
};

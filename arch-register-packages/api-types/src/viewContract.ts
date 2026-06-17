import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

export const browserViewSchema = z.enum(['table', 'cards', 'tree', 'radar', 'timeline', 'matrix']);

export const filterConditionSchema = z.object({
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

export const entityFiltersSchema = z.object({
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

export const radarViewConfigSchema = z.object({
  schemaId: z.string(),
  quadrantFieldId: z.string(),
  ringFieldId: z.string(),
  ringOrder: z.array(z.string())
});

export const timelineViewConfigSchema = z.object({
  startFieldId: z.string().nullable(),
  endFieldId: z.string().nullable(),
  groupBy: z.enum(['owner', 'type', 'snapshot']),
  zoom: z.enum(['month', 'quarter', 'year'])
});

const viewConfigSchema = z
  .object({
    radar: radarViewConfigSchema.optional(),
    timeline: timelineViewConfigSchema.optional()
  })
  .nullable();

export const savedViewSchema = z.object({
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

export const pinnedEntitySchema = z.object({
  entity_id: z.string(),
  entity_public_id: z.string(),
  entity_name: z.string(),
  entity_slug: z.string(),
  schema_id: z.string(),
  created_at: z.string()
});

// ── Request schemas ───────────────────────────────────────────

export const createViewBodySchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  viewMode: browserViewSchema,
  filters: entityFiltersSchema,
  config: viewConfigSchema.optional()
});

export const updateViewBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  viewMode: browserViewSchema.optional(),
  filters: entityFiltersSchema.optional(),
  config: viewConfigSchema.optional()
});

export const getViewRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

const deleteViewResponseSchema = z.object({ success: z.boolean() });

const deletePinnedEntityResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceViewContract = {
  views: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/views', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws
        })
      )
      .output(z.array(savedViewSchema)),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/views', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: createViewBodySchema
        })
      )
      .output(savedViewSchema),
    update: oc
      .route({ method: 'PATCH', path: '/{workspace}/views/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndUUID,
          body: updateViewBodySchema
        })
      )
      .output(savedViewSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/views/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndUUID
        })
      )
      .output(deleteViewResponseSchema)
  },
  pinnedEntities: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/pinned-entities', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws
        })
      )
      .output(z.array(pinnedEntitySchema)),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/pinned-entities', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({ entity_id: z.string() })
        })
      )
      .output(pinnedEntitySchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/pinned-entities/{id}',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndUUID
        })
      )
      .output(deletePinnedEntityResponseSchema)
  }
};

export type BrowserView = z.infer<typeof browserViewSchema>;

export type FilterCondition = z.infer<typeof filterConditionSchema>;

export type EntityFilters = z.infer<typeof entityFiltersSchema>;

export type RadarViewConfig = z.infer<typeof radarViewConfigSchema>;

export type SavedView = z.infer<typeof savedViewSchema>;

export type CreateSavedViewRequest = z.infer<typeof createViewBodySchema>;

export type UpdateSavedViewRequest = z.infer<typeof updateViewBodySchema>;

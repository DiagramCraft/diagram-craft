import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

const foreignKeySchema = z.object({ id: z.string(), name: z.string() });

const entityLinkSchema = z.object({
  url: z.string(),
  title: z.string(),
  type: z.string().optional()
});

const entityCapabilitiesSchema = z.object({
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canAdmin: z.boolean(),
  canCreateChild: z.boolean()
});

const entitySummarySchema = entityCapabilitiesSchema.extend({
  _uid: z.string(),
  _schema: foreignKeySchema,
  _name: z.string(),
  _slug: z.string(),
  _namespace: z.string(),
  _description: z.string(),
  _owner: foreignKeySchema.nullable(),
  _lifecycle: foreignKeySchema.nullable(),
  _targetLifecycle: foreignKeySchema.nullable(),
  _targetLifecycleDate: z.string().nullable(),
  _tags: z.array(z.string()),
  _links: z.array(entityLinkSchema),
  _visibilityMode: z.enum(['public', 'restricted']).nullable(),
  _completeness: z.number().nullable()
});

// EntityRecord = EntitySummary + dynamic schema fields
export const entityRecordSchema = entitySummarySchema.catchall(z.unknown());

// ── Mutation input ────────────────────────────────────────────

const ownerOrIdSchema = z.union([z.string(), z.object({ id: z.string() }).passthrough()]).nullable().optional();

const entityMutationBodySchema = z
  .object({
    _schemaId: z.string().optional(),
    _schema: z.object({ id: z.string(), name: z.string() }).optional(),
    _name: z.string().optional(),
    _slug: z.string().optional(),
    _namespace: z.string().optional(),
    _description: z.string().optional(),
    _owner: ownerOrIdSchema,
    _lifecycle: ownerOrIdSchema,
    _targetLifecycle: ownerOrIdSchema,
    _targetLifecycleDate: z.string().nullable().optional(),
    _tags: z.array(z.string()).optional(),
    _links: z.array(entityLinkSchema).optional(),
    _visibilityMode: z.enum(['public', 'restricted']).nullable().optional()
  })
  .catchall(z.unknown());

// ── Query / filter input ──────────────────────────────────────

const listFiltersSchema = z.object({
  _schemaId: z.string().optional(),
  owner: z.string().optional(),
  lifecycle: z.string().optional(),
  q: z.string().optional()
});

const paginationSchema = z.object({
  limit: z.preprocess(
    v => (v !== undefined ? Number(v) : undefined),
    z.number().int().positive().optional()
  ),
  offset: z.preprocess(
    v => (v !== undefined ? Number(v) : undefined),
    z.number().int().min(0).optional()
  )
});

export const listEntitiesRequestSchema = listFiltersSchema
  .merge(paginationSchema)
  .extend({
    workspace: z.string(),
    view: z.enum(['summary', 'full']).optional()
  });

export const getEntityRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

export const treeRequestSchema = listFiltersSchema.extend({ workspace: z.string() });

export const facetsRequestSchema = z.object({ workspace: z.string() });

export const createEntityRequestSchema = entityMutationBodySchema.extend({
  workspace: z.string()
});

export const updateEntityRequestSchema = entityMutationBodySchema.extend({
  workspace: z.string(),
  id: z.string()
});

export const deleteEntityResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

// ── Facets ────────────────────────────────────────────────────

const entityFacetBucketSchema = z.object({
  label: z.string(),
  value: z.string().nullable(),
  count: z.number().int()
});

export const entityFacetsSchema = z.object({
  total: z.number().int(),
  lifecycle: z.array(entityFacetBucketSchema),
  owner: z.array(entityFacetBucketSchema),
  schema: z.array(z.object({ schemaId: z.string(), count: z.number().int() })),
  completeness: z.object({
    below50: z.number().int(),
    below80: z.number().int(),
    above80: z.number().int()
  })
});

// ── Tree ──────────────────────────────────────────────────────

const treeNodeSchema = entitySummarySchema.extend({ _isMatch: z.boolean() });
const treeEdgeSchema = z.object({ childId: z.string(), parentId: z.string() });

export const treeResponseSchema = z.object({
  nodes: z.array(treeNodeSchema),
  edges: z.array(treeEdgeSchema)
});

// ── Relations ─────────────────────────────────────────────────

const entityRelationSchema = z.object({
  entityId: z.string(),
  entitySlug: z.string(),
  entityName: z.string(),
  entitySchemaId: z.string(),
  fieldName: z.string(),
  kind: z.enum(['reference', 'containment'])
});

export const entityRelationsSchema = z.object({
  outgoing: z.array(entityRelationSchema),
  incoming: z.array(entityRelationSchema)
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceEntityContract = {
  entities: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/data' })
      .input(listEntitiesRequestSchema)
      .output(z.array(entityRecordSchema)),
    facets: oc
      .route({ method: 'GET', path: '/{workspace}/data/facets' })
      .input(facetsRequestSchema)
      .output(entityFacetsSchema),
    tree: oc
      .route({ method: 'GET', path: '/{workspace}/data/tree' })
      .input(treeRequestSchema)
      .output(treeResponseSchema),
    get: oc
      .route({ method: 'GET', path: '/{workspace}/data/{id}' })
      .input(getEntityRequestSchema)
      .output(entityRecordSchema),
    relations: oc
      .route({ method: 'GET', path: '/{workspace}/data/{id}/relations' })
      .input(getEntityRequestSchema)
      .output(entityRelationsSchema),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/data' })
      .input(createEntityRequestSchema)
      .output(entityRecordSchema),
    update: oc
      .route({ method: 'PUT', path: '/{workspace}/data/{id}' })
      .input(updateEntityRequestSchema)
      .output(entityRecordSchema),
    clone: oc
      .route({ method: 'POST', path: '/{workspace}/data/{id}/clone' })
      .input(getEntityRequestSchema)
      .output(entityRecordSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/data/{id}' })
      .input(getEntityRequestSchema)
      .output(deleteEntityResponseSchema)
  }
};

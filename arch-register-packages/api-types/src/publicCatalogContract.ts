import { oc } from '@orpc/contract';
import { z } from 'zod';
import { identifierRedirectSchema, ws } from '@arch-register/api-types/common';
import {
  apiSpecificationItemSchema,
  apiSpecificationRevisionSchema,
  artifactRevisionContentSchema,
  artifactStatusSchema
} from '@arch-register/api-types/artifactContract';

/**
 * Publication is deliberately an allow-list. An empty list means that no custom
 * fields, pages, or API sources are exposed until an administrator opts them in.
 */
export const publicCatalogSchemaPublicationSchema = z.object({
  schemaId: z.string().min(1),
  fieldIds: z.array(z.string().min(1)).default([])
});

export const publicCatalogEntityOverrideSchema = z.object({
  entityId: z.string().min(1),
  mode: z.enum(['publish', 'exclude']),
  fieldIds: z.array(z.string().min(1)).optional()
});

export const publicCatalogPageSchema = z.object({
  nodeId: z.string().min(1),
  scope: z.enum(['workspace', 'entity']),
  entityId: z.string().min(1).optional(),
  publicPath: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/),
  label: z.string().max(200).optional(),
  order: z.number().int().min(0).default(0)
});

export const publicCatalogApiArtifactSchema = z.object({
  artifactId: z.string().min(1),
  revisionId: z.string().min(1).optional(),
  exposeRaw: z.boolean().default(false)
});

export const publicCatalogConfigSchema = z.object({
  enabled: z.boolean().default(false),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  indexable: z.boolean().default(false),
  schemas: z.array(publicCatalogSchemaPublicationSchema).default([]),
  entityOverrides: z.array(publicCatalogEntityOverrideSchema).default([]),
  pages: z.array(publicCatalogPageSchema).default([]),
  apiArtifacts: z.array(publicCatalogApiArtifactSchema).default([])
});

export const publicCatalogConfigOutputSchema = publicCatalogConfigSchema.extend({
  updatedAt: z.string().nullable()
});

export const publicCatalogFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional()
});

export const publicCatalogSchemaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  keyPrefix: z.string(),
  fields: z.array(publicCatalogFieldSchema)
});

export const publicCatalogPageSummarySchema = z.object({
  path: z.string(),
  label: z.string(),
  scope: z.enum(['workspace', 'entity']),
  entityPublicId: z.string().nullable()
});

export const publicCatalogApiArtifactSummarySchema = z.object({
  artifactId: z.string(),
  entityPublicId: z.string(),
  title: z.string().nullable(),
  protocol: z.enum(['openapi', 'asyncapi']).nullable(),
  currentRevisionId: z.string().nullable(),
  rawAvailable: z.boolean()
});

export const publicCatalogManifestSchema = z.object({
  workspace: z.string(),
  title: z.string(),
  description: z.string(),
  indexable: z.boolean(),
  schemas: z.array(publicCatalogSchemaSchema),
  pages: z.array(publicCatalogPageSummarySchema),
  apiArtifacts: z.array(publicCatalogApiArtifactSummarySchema),
  entityCount: z.number().int().min(0),
  endpoints: z.object({
    entities: z.string(),
    topology: z.string(),
    wiki: z.string()
  })
});

const selectorEligibilitySchema = z.object({
  selectable: z.boolean(),
  reason: z.string().optional()
});

export const publicCatalogSelectorFieldSchema = publicCatalogFieldSchema.extend(
  selectorEligibilitySchema.shape
);

export const publicCatalogSelectorSchemaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  keyPrefix: z.string(),
  fields: z.array(publicCatalogSelectorFieldSchema)
});

export const publicCatalogSelectorEntitySchema = z.object({
  id: z.string(),
  publicId: z.string(),
  slug: z.string(),
  name: z.string(),
  schemaId: z.string(),
  schemaName: z.string(),
  projectOnly: z.boolean(),
  ...selectorEligibilitySchema.shape
});

export const publicCatalogSelectorPageSchema = z.object({
  nodeId: z.string(),
  scope: z.enum(['workspace', 'entity']),
  entityId: z.string().nullable(),
  entityPublicId: z.string().nullable(),
  entityName: z.string().nullable(),
  path: z.string(),
  name: z.string(),
  ...selectorEligibilitySchema.shape
});

export const publicCatalogSelectorRevisionSchema = apiSpecificationRevisionSchema.extend(
  selectorEligibilitySchema.shape
);

export const publicCatalogSelectorApiArtifactSchema = z.object({
  artifactId: z.string(),
  entityId: z.string(),
  entityPublicId: z.string(),
  entityName: z.string(),
  label: z.string(),
  status: artifactStatusSchema,
  currentRevisionId: z.string().nullable(),
  revisions: z.array(publicCatalogSelectorRevisionSchema),
  ...selectorEligibilitySchema.shape
});

export const publicCatalogSelectorOptionsSchema = z.object({
  schemas: z.array(publicCatalogSelectorSchemaSchema),
  entities: z.array(publicCatalogSelectorEntitySchema),
  pages: z.array(publicCatalogSelectorPageSchema),
  apiArtifacts: z.array(publicCatalogSelectorApiArtifactSchema)
});

export const publicCatalogPreviewSchema = z.object({
  enabled: z.boolean(),
  manifest: publicCatalogManifestSchema
});

export const publicCatalogEntitySchema = z.object({
  publicId: z.string(),
  slug: z.string(),
  name: z.string(),
  namespace: z.string(),
  description: z.string(),
  owner: z.string().nullable(),
  lifecycle: z.string().nullable(),
  tags: z.array(z.string()),
  updatedAt: z.string(),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    keyPrefix: z.string(),
    fields: z.array(publicCatalogFieldSchema)
  }),
  fields: z.record(z.string(), z.unknown()),
  apiArtifacts: z.array(publicCatalogApiArtifactSummarySchema),
  redirect: identifierRedirectSchema.optional()
});

export const publicCatalogEntityListSchema = z.object({
  items: z.array(publicCatalogEntitySchema),
  total: z.number().int().min(0)
});

export const publicCatalogTopologyNodeSchema = z.object({
  publicId: z.string(),
  slug: z.string(),
  name: z.string(),
  schema: z.object({
    name: z.string(),
    keyPrefix: z.string()
  }),
  isRoot: z.boolean()
});

export const publicCatalogTopologyEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
  kind: z.enum(['reference', 'containment', 'typed'])
});

export const publicCatalogTopologySchema = z.object({
  rootPublicId: z.string(),
  nodes: z.array(publicCatalogTopologyNodeSchema),
  edges: z.array(publicCatalogTopologyEdgeSchema),
  depth: z.number().int().min(1).max(3),
  direction: z.enum(['both', 'incoming', 'outgoing']),
  truncated: z.boolean(),
  limits: z.object({
    nodes: z.number().int().positive(),
    edges: z.number().int().positive()
  }),
  redirect: identifierRedirectSchema.optional()
});

export const publicCatalogWikiPageSchema = z.object({
  path: z.string(),
  label: z.string(),
  scope: z.enum(['workspace', 'entity']),
  entityPublicId: z.string().nullable(),
  body: z.string(),
  updatedAt: z.string()
});

export const publicCatalogApiSpecificationPageSchema = z.object({
  revision: apiSpecificationRevisionSchema,
  items: z.array(apiSpecificationItemSchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(0),
  offset: z.number().int().min(0),
  redirect: identifierRedirectSchema.optional()
});

export const publicCatalogArtifactRevisionContentSchema = artifactRevisionContentSchema.extend({
  redirect: identifierRedirectSchema.optional()
});

const publicCatalogEntityParamsSchema = z.object({
  workspace: z.string(),
  entityPublicId: z.string()
});

const publicCatalogArtifactParamsSchema = publicCatalogEntityParamsSchema.extend({
  artifactId: z.string()
});

const publicCatalogRevisionParamsSchema = publicCatalogArtifactParamsSchema.extend({
  revisionId: z.string()
});

const publicCatalogProjectionQuerySchema = z.object({
  q: z.string().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  kind: z.enum(['operation', 'message']).optional(),
  tag: z.string().optional(),
  deprecated: z.preprocess(
    value => (value === 'true' ? true : value === 'false' ? false : value),
    z.boolean().optional()
  ),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const publicCatalogTopologyQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(3).default(2),
  direction: z.enum(['both', 'incoming', 'outgoing']).default('both')
});

export const publicCatalogContract = oc.tag('Public Catalog').router({
  manifest: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/manifest',
        inputStructure: 'detailed',
        summary: 'Get the public catalog manifest',
        description:
          'Returns the deterministic, cacheable entry point for a workspace public catalog.',
        tags: ['Public Catalog']
      })
      .input(z.object({ params: ws }))
      .output(publicCatalogManifestSchema)
  },
  entities: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities',
        inputStructure: 'detailed',
        summary: 'List published entities',
        description: 'Lists only entities and fields explicitly published by the workspace.',
        tags: ['Public Catalog']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({
            q: z.string().optional(),
            schema: z.string().optional(),
            limit: z.coerce.number().int().min(1).max(200).default(50),
            offset: z.coerce.number().int().min(0).default(0)
          })
        })
      )
      .output(publicCatalogEntityListSchema),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityPublicId}',
        inputStructure: 'detailed',
        summary: 'Get a published entity',
        description: 'Returns an allow-listed public entity projection.',
        tags: ['Public Catalog']
      })
      .input(z.object({ params: publicCatalogEntityParamsSchema }))
      .output(publicCatalogEntitySchema)
  },
  topology: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/topology/{entityPublicId}',
        inputStructure: 'detailed',
        summary: 'Get a published entity topology',
        description:
          'Returns a bounded, publication-safe graph around a published entity. Only explicitly published relationships and published endpoints are included.',
        tags: ['Public Catalog']
      })
      .input(
        z.object({
          params: publicCatalogEntityParamsSchema,
          query: publicCatalogTopologyQuerySchema
        })
      )
      .output(publicCatalogTopologySchema)
  },
  wiki: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/wiki',
        inputStructure: 'detailed',
        summary: 'Get a published wiki page',
        description: 'Returns workspace- or entity-scoped Markdown explicitly published by admins.',
        tags: ['Public Catalog']
      })
      .input(z.object({ params: ws, query: z.object({ path: z.string().min(1) }) }))
      .output(publicCatalogWikiPageSchema)
  },
  apiSpecifications: {
    revisions: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityPublicId}/api-specifications/{artifactId}/revisions',
        inputStructure: 'detailed',
        summary: 'List published API specification revisions',
        description: 'Returns normalized API specification revision metadata.',
        tags: ['Public Catalog']
      })
      .input(z.object({ params: publicCatalogArtifactParamsSchema }))
      .output(z.array(apiSpecificationRevisionSchema)),
    items: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityPublicId}/api-specifications/{artifactId}/revisions/{revisionId}',
        inputStructure: 'detailed',
        summary: 'Browse a published API specification',
        description: 'Returns normalized OpenAPI operations or AsyncAPI messages.',
        tags: ['Public Catalog']
      })
      .input(
        z.object({
          params: publicCatalogRevisionParamsSchema,
          query: publicCatalogProjectionQuerySchema
        })
      )
      .output(publicCatalogApiSpecificationPageSchema),
    raw: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityPublicId}/api-specifications/{artifactId}/revisions/{revisionId}/content',
        inputStructure: 'detailed',
        summary: 'Get an explicitly published raw API specification',
        description:
          'Returns raw source only when the workspace has enabled raw exposure for this artifact.',
        tags: ['Public Catalog']
      })
      .input(z.object({ params: publicCatalogRevisionParamsSchema }))
      .output(publicCatalogArtifactRevisionContentSchema)
  }
});

export const publicCatalogConfigContract = oc.tag('Public Catalog Configuration').router({
  publicCatalogConfig: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/config/public-catalog',
        inputStructure: 'detailed',
        summary: 'Get public catalog configuration',
        description: 'Returns the workspace public catalog publication allow-list.',
        tags: ['Workspace Config']
      })
      .input(z.object({ params: ws }))
      .output(publicCatalogConfigOutputSchema),
    options: oc
      .route({
        method: 'GET',
        path: '/{workspace}/config/public-catalog/options',
        inputStructure: 'detailed',
        summary: 'Get public catalog selector options',
        description:
          'Returns labeled, eligibility-aware entities, Markdown pages, API artifacts, revisions, and fields for guided publication settings.',
        tags: ['Workspace Config']
      })
      .input(z.object({ params: ws }))
      .output(publicCatalogSelectorOptionsSchema),
    preview: oc
      .route({
        method: 'POST',
        path: '/{workspace}/config/public-catalog/preview',
        inputStructure: 'detailed',
        summary: 'Preview public catalog configuration',
        description:
          'Validates an unsaved public catalog configuration and returns the manifest it would produce without persisting changes.',
        tags: ['Workspace Config']
      })
      .input(z.object({ params: ws, body: publicCatalogConfigSchema }))
      .output(publicCatalogPreviewSchema),
    replace: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/config/public-catalog',
        inputStructure: 'detailed',
        summary: 'Replace public catalog configuration',
        description:
          'Replaces the complete public catalog publication allow-list. Publication is disabled by default.',
        tags: ['Workspace Config']
      })
      .input(z.object({ params: ws, body: publicCatalogConfigSchema }))
      .output(publicCatalogConfigOutputSchema)
  }
});

export type PublicCatalogConfig = z.infer<typeof publicCatalogConfigSchema>;
export type PublicCatalogSchemaPublication = z.infer<typeof publicCatalogSchemaPublicationSchema>;
export type PublicCatalogEntityOverride = z.infer<typeof publicCatalogEntityOverrideSchema>;
export type PublicCatalogPage = z.infer<typeof publicCatalogPageSchema>;
export type PublicCatalogApiArtifact = z.infer<typeof publicCatalogApiArtifactSchema>;
export type PublicCatalogSelectorOptions = z.infer<typeof publicCatalogSelectorOptionsSchema>;
export type PublicCatalogPreview = z.infer<typeof publicCatalogPreviewSchema>;
export type PublicCatalogEntity = z.infer<typeof publicCatalogEntitySchema>;
export type PublicCatalogManifest = z.infer<typeof publicCatalogManifestSchema>;
export type PublicCatalogEntityList = z.infer<typeof publicCatalogEntityListSchema>;
export type PublicCatalogTopologyNode = z.infer<typeof publicCatalogTopologyNodeSchema>;
export type PublicCatalogTopologyEdge = z.infer<typeof publicCatalogTopologyEdgeSchema>;
export type PublicCatalogTopology = z.infer<typeof publicCatalogTopologySchema>;
export type PublicCatalogWikiPage = z.infer<typeof publicCatalogWikiPageSchema>;
export type PublicCatalogApiSpecificationPage = z.infer<
  typeof publicCatalogApiSpecificationPageSchema
>;

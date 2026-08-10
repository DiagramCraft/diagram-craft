import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import { entityRecordSchema } from '@arch-register/api-types/entityContract';
import { entityCapabilityTypeSchema } from './entityCapabilityContract';

/** A functionality-driving artifact profile, not an arbitrary file extension. */
export const artifactTypeSchema = entityCapabilityTypeSchema.describe(
  'Artifact profile identifier, such as api-specification'
);

export const artifactSourceKindSchema = z
  .enum(['document', 'url', 'repository', 'link'])
  .describe('How an artifact is provided');

export const artifactStatusSchema = z
  .enum([
    'not_configured',
    'link_only',
    'pending',
    'current',
    'stale',
    'failed',
    'invalid',
    'unsupported'
  ])
  .describe('Current artifact processing status');

export const artifactDiagnosticCategorySchema = z
  .enum([
    'invalid_source',
    'unsupported_media_type',
    'unsupported_version',
    'source_unavailable',
    'source_forbidden',
    'source_timeout',
    'source_too_large',
    'security_blocked',
    'normalization_failed'
  ])
  .describe('Stable artifact processing diagnostic category');

export const artifactDiagnosticSchema = z.object({
  category: artifactDiagnosticCategorySchema,
  message: z.string().describe('Safe diagnostic message; source content and secrets are excluded'),
  timestamp: z.string().describe('ISO 8601 diagnostic timestamp')
});

export const artifactSchema = z.object({
  id: z.string().describe('Artifact identifier'),
  workspace: z.string().describe('Workspace identifier'),
  entityId: z.string().describe('Owning catalog entity identifier'),
  artifactType: artifactTypeSchema,
  kind: artifactSourceKindSchema,
  location: z.string().nullable().describe('Source location or null for submitted content'),
  mediaType: z.string().nullable().describe('Declared source media type'),
  status: artifactStatusSchema,
  currentRevisionId: z.string().nullable().describe('Last successful artifact revision'),
  lastAttemptAt: z
    .string()
    .nullable()
    .describe('ISO 8601 timestamp of the last processing attempt'),
  lastSuccessAt: z
    .string()
    .nullable()
    .describe('ISO 8601 timestamp of the last successful processing'),
  diagnostic: artifactDiagnosticSchema.nullable(),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 update timestamp')
});

export const artifactRevisionSchema = z.object({
  id: z.string().describe('Immutable artifact revision identifier'),
  artifactId: z.string().describe('Owning artifact identifier'),
  sourceRevision: z.string().nullable().describe('Provider or repository revision identifier'),
  checksum: z.string().describe('SHA-256 checksum of the accepted artifact document'),
  mediaType: z.string().nullable().describe('Source media type'),
  contentSize: z.number().int().min(0).describe('Stored source size in bytes'),
  createdAt: z.string().describe('ISO 8601 acceptance timestamp')
});

export const artifactRevisionContentSchema = artifactRevisionSchema.extend({
  content: z
    .string()
    .describe('Raw artifact content; only returned by the explicit content endpoint')
});

export const apiSpecificationProtocolSchema = z.enum(['openapi', 'asyncapi']);
export const apiSpecificationItemKindSchema = z.enum(['operation', 'message']);
export const apiSpecificationDiagnosticSeveritySchema = z.enum(['error', 'warning']);
export const apiSpecificationDiagnosticCategorySchema = z.enum([
  'parse_error',
  'validation_error',
  'unsupported_media_type',
  'unsupported_version',
  'unsupported_construct',
  'unresolved_reference',
  'duplicate_identifier',
  'missing_identifier',
  'resource_limit',
  'normalization_error'
]);

export const apiSpecificationSourceLocationSchema = z.object({
  pointer: z.string().describe('JSON Pointer into the source document'),
  line: z.number().int().min(1).nullable().describe('1-based source line when available'),
  column: z.number().int().min(1).nullable().describe('1-based source column when available')
});

export const apiSpecificationDiagnosticSchema = z.object({
  severity: apiSpecificationDiagnosticSeveritySchema,
  category: apiSpecificationDiagnosticCategorySchema,
  code: z.string(),
  message: z.string(),
  source: apiSpecificationSourceLocationSchema.nullable()
});

export const apiSpecificationItemSchema = z.object({
  id: z.string(),
  itemKey: z.string().describe('Stable source-relative item key'),
  revisionId: z.string(),
  protocol: apiSpecificationProtocolSchema,
  itemKind: apiSpecificationItemKindSchema,
  path: z.string().nullable(),
  channel: z.string().nullable(),
  action: z.string(),
  identifier: z.string(),
  declaredIdentifier: z.string().nullable(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  deprecated: z.boolean(),
  parameters: z.array(z.record(z.string(), z.unknown())),
  input: z.record(z.string(), z.unknown()).nullable(),
  output: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()),
  source: apiSpecificationSourceLocationSchema
});

export const apiSpecificationRevisionSchema = z.object({
  revision: artifactRevisionSchema,
  protocol: apiSpecificationProtocolSchema.nullable(),
  specificationVersion: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(['current', 'invalid', 'unsupported']),
  isCurrent: z.boolean().describe("Whether this is the artifact's current successful revision"),
  itemCount: z.number().int().min(0),
  diagnostics: z.array(apiSpecificationDiagnosticSchema)
});

const projectionQueryNumber = (defaultValue: number) =>
  z.coerce.number().int().min(0).default(defaultValue);

const projectionQueryBoolean = z.preprocess(
  value => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean().optional()
);

const projectionQuerySchema = z.object({
  q: z.string().max(200).optional(),
  resource: z.string().max(500).optional(),
  action: z.string().max(100).optional(),
  kind: apiSpecificationItemKindSchema.optional(),
  tag: z.string().max(200).optional(),
  deprecated: projectionQueryBoolean,
  limit: projectionQueryNumber(50).transform(value => Math.min(value, 200)),
  offset: projectionQueryNumber(0)
});

export const apiSpecificationProjectionPageSchema = z.object({
  revision: apiSpecificationRevisionSchema,
  items: z.array(apiSpecificationItemSchema),
  total: z.number().int().min(0),
  limit: z.number().int().min(0),
  offset: z.number().int().min(0)
});

export const artifactCollectionSchema = z.object({
  entity: entityRecordSchema,
  artifacts: z.array(artifactSchema),
  status: artifactStatusSchema.describe('Aggregate status across the entity artifacts')
});

const createArtifactBodySchema = z.object({
  artifactType: artifactTypeSchema,
  kind: artifactSourceKindSchema,
  location: z.string().max(2000).nullable().optional(),
  mediaType: z.string().max(200).nullable().optional()
});

const updateArtifactBodySchema = z.object({
  status: artifactStatusSchema,
  diagnostic: artifactDiagnosticSchema.nullable().optional()
});

const createRevisionBodySchema = z.object({
  sourceRevision: z.string().max(500).nullable().optional(),
  mediaType: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(2_000_000)
});

const entityParamsSchema = ws.extend({ entityId: z.string() });
const artifactParamsSchema = entityParamsSchema.extend({ artifactId: z.string() });
const revisionParamsSchema = artifactParamsSchema.extend({ revisionId: z.string() });

export const artifactContract = oc.tag('Artifacts').router({
  artifacts: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/artifacts',
        inputStructure: 'detailed',
        summary: 'List entity artifacts',
        description:
          'Lists functionality-driving artifacts attached to an existing catalog entity.',
        tags: ['Artifacts']
      })
      .input(z.object({ params: entityParamsSchema }))
      .output(artifactCollectionSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/artifacts',
        inputStructure: 'detailed',
        summary: 'Register an entity artifact',
        description:
          'Registers a typed artifact profile and its source without accepting arbitrary binary documents.',
        tags: ['Artifacts']
      })
      .input(z.object({ params: entityParamsSchema, body: createArtifactBodySchema }))
      .output(artifactSchema),
    refresh: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/artifacts/{artifactId}/refresh',
        inputStructure: 'detailed',
        summary: 'Refresh a URL artifact',
        description:
          'Queues a secure refresh for an HTTPS URL artifact and preserves its last successful revision while processing.',
        tags: ['Artifacts']
      })
      .input(z.object({ params: artifactParamsSchema }))
      .output(artifactSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/entities/{entityId}/artifacts/{artifactId}',
        inputStructure: 'detailed',
        summary: 'Update artifact status',
        description:
          'Records a safe processing status and diagnostic without changing the last successful revision.',
        tags: ['Artifacts']
      })
      .input(z.object({ params: artifactParamsSchema, body: updateArtifactBodySchema }))
      .output(artifactSchema),
    listApiSpecificationRevisions: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/artifacts/{artifactId}/revisions',
        inputStructure: 'detailed',
        summary: 'List API specification revisions',
        description:
          'Lists API specification revision metadata, including current status and diagnostics, without returning raw source content.',
        tags: ['Artifacts']
      })
      .input(z.object({ params: artifactParamsSchema }))
      .output(z.array(apiSpecificationRevisionSchema)),
    createRevision: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/artifacts/{artifactId}/revisions',
        inputStructure: 'detailed',
        summary: 'Record an artifact revision',
        description:
          'Stores an accepted bounded artifact document and advances the artifact current revision.',
        tags: ['Artifacts']
      })
      .input(z.object({ params: artifactParamsSchema, body: createRevisionBodySchema }))
      .output(artifactRevisionSchema),
    getRevisionContent: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/artifacts/{artifactId}/revisions/{revisionId}/content',
        inputStructure: 'detailed',
        summary: 'Get artifact content',
        description: 'Returns raw artifact content through an explicitly authorized endpoint.',
        tags: ['Artifacts']
      })
      .input(z.object({ params: revisionParamsSchema }))
      .output(artifactRevisionContentSchema),
    listApiSpecification: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/artifacts/{artifactId}/revisions/{revisionId}/projections/api-specification',
        inputStructure: 'detailed',
        summary: 'List API specification projection items',
        description:
          'Lists projected OpenAPI operations or AsyncAPI messages without returning the raw source document.',
        tags: ['Artifacts']
      })
      .input(z.object({ params: revisionParamsSchema, query: projectionQuerySchema }))
      .output(apiSpecificationProjectionPageSchema)
  }
});

export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type ArtifactRevision = z.infer<typeof artifactRevisionSchema>;
export type ArtifactSourceKind = z.infer<typeof artifactSourceKindSchema>;
export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;
export type ArtifactDiagnosticCategory = z.infer<typeof artifactDiagnosticCategorySchema>;
export type ApiSpecificationProtocol = z.infer<typeof apiSpecificationProtocolSchema>;
export type ApiSpecificationItemKind = z.infer<typeof apiSpecificationItemKindSchema>;
export type ApiSpecificationDiagnosticSeverity = z.infer<
  typeof apiSpecificationDiagnosticSeveritySchema
>;
export type ApiSpecificationDiagnosticCategory = z.infer<
  typeof apiSpecificationDiagnosticCategorySchema
>;
export type ApiSpecificationSourceLocation = z.infer<typeof apiSpecificationSourceLocationSchema>;
export type ApiSpecificationDiagnostic = z.infer<typeof apiSpecificationDiagnosticSchema>;
export type ApiSpecificationItem = z.infer<typeof apiSpecificationItemSchema>;
export type ApiSpecificationRevision = z.infer<typeof apiSpecificationRevisionSchema>;
export type ApiSpecificationProjectionQuery = z.infer<typeof projectionQuerySchema>;

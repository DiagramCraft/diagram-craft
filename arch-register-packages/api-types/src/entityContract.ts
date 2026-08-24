import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  ws,
  wsAndId,
  foreignKeySchema,
  externalMetadataSchema,
  externalUpdateEnvelopeSchema
} from '@arch-register/api-types/common';
import { conditionsQuerySchema } from '@arch-register/api-types/viewContract';
import { entityVersionSchema } from '@arch-register/api-types/entityVersionContract';
import {
  changeCaseMemberSchema,
  changeCaseSummarySchema
} from '@arch-register/api-types/changeCaseContract';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { relationRecordSchema } from '@arch-register/api-types/relationContract';
import { entityConformanceStatusSchema } from '@arch-register/api-types/conformanceContract';

// ── Query text ⇄ IR (specs/QUERY_LANGUAGE.md §4) ───────────────

const entityQueryParseErrorSchema = z.object({
  offset: z.number().int().describe('Character offset in the input text where parsing failed'),
  message: z.string().describe('Human-readable parse error message')
});

const entityQueryParseResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), query: entityQuerySchema }),
  z.object({ ok: z.literal(false), errors: z.array(entityQueryParseErrorSchema) })
]);

// ── Shared sub-schemas ────────────────────────────────────────

const entityLinkSchema = z.object({
  url: z.string().describe('Link URL'),
  title: z.string().describe('Link title/label'),
  type: z.string().optional().describe('Link type (e.g., "documentation", "repository")')
});

const projectLinkSchema = z.object({
  linked: z.boolean().describe('Whether the entity is linked to a project'),
  entityType: foreignKeySchema.nullable().describe('Project entity type classification'),
  isDone: z.boolean().describe('Whether the entity is marked as done in the project')
});

const entityValidationDiagnosticSchema = z.object({
  ruleId: z.string(),
  entityId: z.string(),
  schemaId: z.string(),
  schemaVersion: z.number().int().min(1),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  fieldId: z.string().optional()
});

const entityValidationResultSchema = z.object({
  entityId: z.string(),
  schemaId: z.string(),
  schemaVersion: z.number().int().min(1),
  errors: z.array(entityValidationDiagnosticSchema),
  warnings: z.array(entityValidationDiagnosticSchema)
});

const entityCapabilitiesSchema = z.object({
  canView: z.boolean().describe('Whether the user can view this entity'),
  canEdit: z.boolean().describe('Whether the user can edit this entity'),
  canDelete: z.boolean().describe('Whether the user can delete this entity'),
  canAdmin: z.boolean().describe('Whether the user can manage entity permissions'),
  canCreateChild: z.boolean().describe('Whether the user can create child entities')
});

const entitySummarySchema = entityCapabilitiesSchema.extend({
  _uid: z.string().describe('Unique entity identifier'),
  _publicId: z.string().describe('Public entity identifier (e.g., APP-001)'),
  _schema: foreignKeySchema.describe('Entity schema reference'),
  _name: z.string().describe('Entity name'),
  _slug: z.string().describe('Entity URL slug'),
  _namespace: z.string().describe('Entity namespace for organization'),
  _description: z.string().describe('Entity description'),
  _owner: foreignKeySchema.nullable().describe('Entity owner'),
  _lifecycle: foreignKeySchema.nullable().describe('Current lifecycle state'),
  _targetLifecycle: foreignKeySchema.nullable().describe('Target lifecycle state'),
  _targetLifecycleDate: z
    .string()
    .nullable()
    .describe('Target date for lifecycle transition (ISO 8601)'),
  _tags: z.array(z.string()).describe('Entity tags'),
  _links: z.array(entityLinkSchema).describe('External links associated with the entity'),
  _updatedAt: z
    .string()
    .optional()
    .describe("ISO 8601 timestamp of the entity's most recent update"),
  _version: z.number().int().min(1).optional().describe('Optimistic concurrency version'),
  _approvalPolicyOverride: z
    .enum(['required', 'disabled'])
    .nullable()
    .optional()
    .describe('Entity-specific approval policy override'),
  _projectId: z
    .string()
    .nullable()
    .describe(
      'Set when this entity was created solely for one project — excluded from global ' +
        'listings/search, visible only within that project. Distinct from _projectLink, which ' +
        'associates an otherwise-normal entity with a project without restricting visibility.'
    ),
  _completeness: z.number().nullable().describe('Field completeness percentage (0-100)'),
  _projectLink: projectLinkSchema.optional().describe('Project linkage information'),
  _externalMetadata: externalMetadataSchema
    .optional()
    .describe('Latest external-update metadata, keyed by field id, for external_kind fields'),
  _validation: entityValidationResultSchema
    .optional()
    .describe('Validation diagnostics produced by the most recent mutation response'),
  _conformanceStatus: entityConformanceStatusSchema
    .optional()
    .describe('Aggregate conformance status from the most recent applicable evaluations'),
  _conformanceEvaluatedAt: z
    .string()
    .nullable()
    .optional()
    .describe('Timestamp of the most recent successful applicable conformance evaluation'),
  _conformanceStale: z
    .boolean()
    .optional()
    .describe('Whether conformance coverage is incomplete, old, or predates the entity update'),
  _projections: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Values returned by structured EntityQuery projections')
});

// EntityRecord = EntitySummary + dynamic schema fields
export const entityRecordSchema = entitySummarySchema
  .catchall(z.unknown())
  .describe('Complete entity record with schema-specific fields');

// ── Mutation input ────────────────────────────────────────────

const ownerOrIdSchema = z
  .union([z.string(), z.object({ id: z.string() }).passthrough()])
  .nullable()
  .optional()
  .describe('Owner reference (ID string or object with id)');

const relationRecordDraftSchema = z.object({
  otherEntityId: z.string().describe('Id of the entity at the non-owning end of the relation'),
  data: z.record(z.string(), z.unknown()).describe('Relation instance field values')
});

const relationRecordUpdateDraftSchema = z.object({
  id: z.string().describe('Relation record _uid to update'),
  data: z.record(z.string(), z.unknown()).describe('Relation instance field values to merge')
});

const relationFieldDeltaSchema = z.object({
  relationSchemaId: z
    .string()
    .optional()
    .describe('Relation schema identifier when editing an unprojected endpoint'),
  direction: z
    .enum(['in', 'out'])
    .optional()
    .describe('Entity endpoint direction when editing an unprojected relation'),
  create: z.array(relationRecordDraftSchema).optional().describe('New relation instances to add'),
  update: z
    .array(relationRecordUpdateDraftSchema)
    .optional()
    .describe('Existing relation instances to update'),
  delete: z.array(z.string()).optional().describe('Relation record _uids to remove')
});

export const relationDeltasSchema = z
  .record(z.string(), relationFieldDeltaSchema)
  .describe(
    'Typed-relation instance deltas, keyed by typedRelation field id; unprojected endpoints carry relationSchemaId and direction in the delta'
  );

export const entityMutationBodySchema = z
  .object({
    _schemaId: z.string().optional().describe('Schema identifier'),
    _schema: z.object({ id: z.string(), name: z.string() }).optional().describe('Schema reference'),
    _name: z.string().optional().describe('Entity name'),
    _slug: z.string().optional().describe('Entity URL slug'),
    _namespace: z.string().optional().describe('Entity namespace'),
    _description: z.string().optional().describe('Entity description'),
    _owner: ownerOrIdSchema.describe('Entity owner'),
    _lifecycle: ownerOrIdSchema.describe('Current lifecycle state'),
    _targetLifecycle: ownerOrIdSchema.describe('Target lifecycle state'),
    _targetLifecycleDate: z
      .string()
      .nullable()
      .optional()
      .describe('Target date for lifecycle transition (ISO 8601)'),
    _tags: z.array(z.string()).optional().describe('Entity tags'),
    _links: z.array(entityLinkSchema).optional().describe('External links'),
    _projectId: z
      .string()
      .nullable()
      .optional()
      .describe('Set to scope this entity to a single project; omit or set null for no scope'),
    _external: externalUpdateEnvelopeSchema
      .optional()
      .describe(
        'Present when this mutation is an external update (AI/integration/automation) rather ' +
          'than a user edit; required to write to any field with external_kind set'
      ),
    _relations: relationDeltasSchema
      .optional()
      .describe(
        'Typed-relation instance deltas to apply atomically with this entity update. Projected ' +
          'fields are keyed by typedRelation field id; unprojected endpoints include relationSchemaId ' +
          'and direction in the delta. Each create/update/delete entry is applied in the same ' +
          'transaction as the rest of this mutation.'
      )
  })
  .catchall(z.unknown())
  .describe('Entity mutation data with schema-specific fields');

export type EntityMutationBody = z.infer<typeof entityMutationBodySchema>;

// ── Query / filter input ──────────────────────────────────────

const booleanQuerySchema = z.preprocess(value => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}, z.boolean().optional());

const treeDepthQuerySchema = z.preprocess(value => {
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return value;
}, z.number().int().min(0).max(20).optional());

const entityQueryRequestSchema = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, entityQuerySchema.optional());

export const entityListFiltersSchema = z.object({
  _schemaId: z.string().optional().describe('Filter by schema identifier'),
  _schemaIds: z
    .array(z.string())
    .optional()
    .describe("Filter by multiple schema identifiers (OR'd together)"),
  owner: z.string().optional().describe('Filter by owner identifier'),
  lifecycle: z.string().optional().describe('Filter by lifecycle state'),
  q: z.string().optional().describe('Search query string'),
  conditions: conditionsQuerySchema.describe('Additional filter conditions'),
  entityQuery: entityQueryRequestSchema.describe(
    'Structured EntityQuery IR, serialized as JSON when sent as a GET query parameter'
  ),
  assessmentId: z
    .string()
    .optional()
    .describe(
      'Joined assessment identifier — required when conditions reference assessment fields'
    ),
  projectId: z.string().optional().describe('Filter by project identifier'),
  projectScope: z
    .enum(['project', 'all'])
    .optional()
    .describe(
      'Project mode includes project-owned or project_entity-linked entities; all mode includes global entities and entities owned by the selected project'
    ),
  collectionId: z
    .string()
    .optional()
    .describe("Filter by the current user's collection identifier"),
  asOf: z
    .string()
    .optional()
    .describe(
      'ISO 8601 date/time — if set, return entities reconstructed as they existed/will exist at this point in time (read-only snapshot mode)'
    ),
  includePlannedChanges: booleanQuerySchema
    .optional()
    .describe(
      'When asOf is set, whether to apply planned changes under projects on top of the reconstructed state. Defaults to true.'
    ),
  treeExpansion: z
    .enum(['ancestors', 'both'])
    .optional()
    .describe('Tree context expansion mode; map views use both ancestors and descendants'),
  treeDepth: treeDepthQuerySchema.describe(
    'Maximum descendant depth used when treeExpansion is both'
  )
});

const deleteEntityResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

const entityCountResponseSchema = z.object({
  total: z.number().int().describe('Total number of entities matching the filters')
});

const entityListResponseSchema = z.object({
  items: z.array(entityRecordSchema).describe('Entities on the requested page'),
  total: z.number().int().describe('Total number of entities matching the filters')
});

const entityLandscapeDiffStateSchema = z.object({
  asOf: z
    .string()
    .refine(value => !Number.isNaN(Date.parse(value)), 'Invalid asOf date')
    .describe('ISO 8601 timestamp for the reconstructed state'),
  projectId: z
    .string()
    .optional()
    .describe(
      'Project whose planned changes apply. When comparing two different projects, both states must use projectScope=all.'
    ),
  includePlannedChanges: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to apply planned changes when reconstructing this state'),
  q: entityListFiltersSchema.shape.q,
  conditions: entityListFiltersSchema.shape.conditions,
  assessmentId: entityListFiltersSchema.shape.assessmentId,
  projectScope: entityListFiltersSchema.shape.projectScope,
  collectionId: entityListFiltersSchema.shape.collectionId,
  includeOverdueChanges: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Whether to include planned changes whose target date has already passed but were never ' +
        'applied. Defaults to false — overdue changes are excluded so a diff against "today" ' +
        "isn't skewed by stale, unexecuted plans."
    )
});

const entityLandscapeDiffFieldSchema = z.object({
  current: z.unknown().nullable().optional(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable()
});

const entityLandscapeDiffResponseSchema = z.object({
  added: z.array(entityRecordSchema).describe('Entities present only in the to state'),
  removed: z.array(entityRecordSchema).describe('Entities present only in the from state'),
  changed: z.array(
    z.object({
      entity: entityRecordSchema.describe('The entity in the to state'),
      diff: z.record(z.string(), entityLandscapeDiffFieldSchema)
    })
  ),
  relations: z
    .object({
      added: z
        .array(relationRecordSchema)
        .describe('Relation instances present only in the to state'),
      removed: z
        .array(relationRecordSchema)
        .describe('Relation instances present only in the from state'),
      changed: z.array(
        z.object({
          relation: relationRecordSchema.describe('The relation instance in the to state'),
          diff: z.record(z.string(), entityLandscapeDiffFieldSchema)
        })
      )
    })
    .describe(
      'Relation instance additions/removals/field changes between the two states. Endpoints are ' +
        'immutable, so a relation only ever appears here for existence or field-data changes, ' +
        'never a re-pointed endpoint.'
    )
});

// ── Facets ────────────────────────────────────────────────────

const entityFacetBucketSchema = z.object({
  label: z.string().describe('Facet bucket label'),
  value: z.string().nullable().describe('Facet bucket value'),
  count: z.number().int().describe('Number of entities in this bucket')
});

const timelineMarkerSchema = z.object({
  date: z.string().describe('ISO 8601 date (YYYY-MM-DD)'),
  type: z.enum(['future_update', 'saved_version', 'applied']).describe('Marker event type'),
  count: z.number().int().describe('Number of events on this date')
});

const timelineVersionSchema = entityVersionSchema.omit({ state: true });

const timelineChangeCaseMemberSchema = changeCaseMemberSchema.omit({
  base_state: true,
  proposed_state: true
});

const timelineProjectChangeSchema = z.object({
  changeCase: changeCaseSummarySchema,
  member: timelineChangeCaseMemberSchema
});

const timelineViewDataSchema = z.object({
  versions: z.array(timelineVersionSchema),
  projectChanges: z.array(timelineProjectChangeSchema)
});

const entityFacetsSchema = z.object({
  total: z.number().int().describe('Total number of entities'),
  lifecycle: z.array(entityFacetBucketSchema).describe('Lifecycle state distribution'),
  owner: z.array(entityFacetBucketSchema).describe('Owner distribution'),
  schema: z
    .array(
      z.object({
        schemaId: z.string().describe('Schema identifier'),
        count: z.number().int().describe('Number of entities')
      })
    )
    .describe('Schema distribution'),
  completeness: z
    .object({
      below50: z.number().int().describe('Entities with <50% fields filled'),
      below80: z.number().int().describe('Entities with 50-79% fields filled'),
      above80: z.number().int().describe('Entities with ≥80% fields filled')
    })
    .describe('Field completeness distribution')
});

// ── Tree ──────────────────────────────────────────────────────

const treeResponseSchema = z.object({
  nodes: z
    .array(
      entityRecordSchema.extend({
        _isMatch: z.boolean().describe('Whether this node matches the search criteria')
      })
    )
    .describe('Tree nodes'),
  edges: z
    .array(
      z.object({
        childId: z.string().describe('Child entity identifier'),
        parentId: z.string().describe('Parent entity identifier')
      })
    )
    .describe('Parent-child relationships')
});

// ── Relations ─────────────────────────────────────────────────

const entityRelationSchema = z.object({
  entityId: z.string().describe('Related entity identifier'),
  publicId: z.string().describe('Related entity public identifier'),
  entitySlug: z.string().describe('Related entity URL slug'),
  entityName: z.string().describe('Related entity name'),
  entitySchemaId: z.string().describe('Related entity schema identifier'),
  fieldName: z
    .string()
    .describe(
      'Relationship field name (for kind "typed", the entity schema\'s typedRelation field ' +
        'name bound to this relation, falling back to the relation schema name)'
    ),
  fieldPredicate: z.string().optional().describe('Relationship predicate/label'),
  kind: z.enum(['reference', 'containment', 'typed']).describe('Relationship type'),
  relationId: z
    .string()
    .optional()
    .describe('Typed relation instance identifier (kind "typed" only)'),
  relationSchemaId: z
    .string()
    .optional()
    .describe('Relation schema identifier (kind "typed" only)'),
  relationSchemaColor: z
    .string()
    .nullable()
    .optional()
    .describe('Relation schema color, hex format (kind "typed" only)'),
  relationSchemaIcon: z
    .string()
    .nullable()
    .optional()
    .describe('Relation schema icon identifier (kind "typed" only)'),
  relationFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Redacted relation instance field values (kind "typed" only)')
});

const entityRelationsSchema = z.object({
  outgoing: z.array(entityRelationSchema).describe('Outgoing relationships from this entity'),
  incoming: z.array(entityRelationSchema).describe('Incoming relationships to this entity')
});

const viaNodeSchema = z.object({
  entityId: z.string().describe('Entity identifier in the dependency chain'),
  entityName: z.string().describe('Entity name in the dependency chain')
});

const entityDependentSchema = entityRelationSchema.extend({
  schemaName: z.string().describe('Schema name of the dependent entity'),
  lifecycleState: z.string().nullable().describe('Lifecycle state of the dependent entity'),
  depth: z.number().int().min(1).describe('Dependency depth (1 = direct)'),
  viaPath: z
    .array(viaNodeSchema)
    .describe('Chain of intermediate entities from the root to this dependent')
});

const entityDependentsSchema = z.object({
  dependents: z.array(entityDependentSchema).describe('Entities that depend on this entity'),
  truncated: z.boolean().describe('True if results were cut off by maxDepth or a node limit')
});

// ── Entity Access ─────────────────────────────────────────────

const entityGrantSchema = z.object({
  id: z.string().describe('Grant identifier'),
  workspace: z.string().describe('Workspace identifier'),
  entity_id: z.string().describe('Entity identifier'),
  principal_type: z.enum(['user', 'team']).describe('Principal type (user or team)'),
  principal_id: z.string().describe('Principal identifier'),
  role: z.enum(['editor', 'contributor', 'entity_admin']).describe('Granted role'),
  applies_to: z
    .enum(['self', 'subtree'])
    .describe('Grant scope (entity only or including children)'),
  created_at: z.string().describe('ISO 8601 creation timestamp')
});

const entityGrantInputSchema = z.object({
  principal_type: z.enum(['user', 'team']).describe('Principal type (user or team)'),
  principal_id: z.string().describe('Principal identifier'),
  role: z.enum(['editor', 'contributor', 'entity_admin']).describe('Role to grant'),
  applies_to: z
    .enum(['self', 'subtree'])
    .describe('Grant scope (entity only or including children)')
});

const entityAccessSchema = z.object({
  owner: z.string().nullable().describe('Entity owner identifier'),
  project_id: z.string().nullable().describe('Set when this entity is scoped to a single project'),
  approval_policy_override: z
    .enum(['required', 'disabled'])
    .nullable()
    .optional()
    .describe('Entity-specific approval policy override'),
  grants: z.array(entityGrantSchema).describe('Permission grants for this entity')
});

// ── Import ────────────────────────────────────────────────────

const importNameMatchSchema = z.object({
  id: z.string().describe('Matched entity identifier'),
  publicId: z.string().describe('Matched entity public identifier'),
  name: z.string().describe('Matched entity name'),
  slug: z.string().describe('Matched entity slug'),
  namespace: z.string().describe('Matched entity namespace')
});

const importConstraintViolationSchema = z.object({
  type: z.enum(['duplicate_slug', 'wrong_workspace', 'wrong_schema']).describe('Violation type'),
  message: z.string().describe('Violation description')
});

const importEntityRowSchema = z.object({
  rowNumber: z.number().describe('CSV row number'),
  errors: z.array(z.string()).describe('Validation errors for this row'),
  entity: z.record(z.string(), z.unknown()).nullable().describe('Parsed entity data'),
  isUpdate: z.boolean().describe('Whether this is an update to existing entity'),
  matchType: z.enum(['id', 'slug', 'name', 'none']).describe('How the entity was matched'),
  nameMatches: z.array(importNameMatchSchema).describe('Potential name matches'),
  existingId: z.string().nullable().optional().describe('Existing entity identifier if matched'),
  existingEntity: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe('Existing entity data if matched'),
  constraintViolations: z
    .array(importConstraintViolationSchema)
    .optional()
    .describe('Constraint violations')
});

const importParseResponseSchema = z.object({
  schemaId: z.string().describe('Schema identifier'),
  schemaName: z.string().describe('Schema name'),
  totalRows: z.number().describe('Total number of rows in CSV'),
  validRows: z.number().describe('Number of valid rows'),
  entities: z.array(importEntityRowSchema).describe('Parsed entity rows')
});

const importCommitResponseSchema = z.object({
  created: z.number().describe('Number of entities created'),
  updated: z.number().describe('Number of entities updated'),
  ids: z.array(z.string()).describe('Identifiers of created/updated entities')
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceEntityContract = oc.tag('Entities').router({
  entityQueryText: {
    parseText: oc
      .route({
        method: 'GET',
        path: '/{workspace}/query/parse-text',
        inputStructure: 'detailed',
        summary: 'Parse a text query into EntityQuery IR',
        description:
          'Parses the qualifier-style text query grammar (specs/QUERY_LANGUAGE.md §4) into the structured ' +
          'EntityQuery IR, or returns structured parse errors.',
        tags: ['Entities']
      })
      .input(z.object({ params: ws, query: z.object({ text: z.string() }) }))
      .output(entityQueryParseResultSchema),
    printText: oc
      .route({
        method: 'POST',
        path: '/{workspace}/query/print-text',
        inputStructure: 'detailed',
        summary: 'Print EntityQuery IR as text',
        description: 'Renders a structured EntityQuery IR back into its canonical text-query form.',
        tags: ['Entities']
      })
      .input(z.object({ params: ws, body: z.object({ query: entityQuerySchema }) }))
      .output(z.object({ text: z.string() }))
  },
  entities: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data',
        inputStructure: 'detailed',
        summary: 'List entities',
        description:
          'Retrieves entities with optional filtering by schema, owner, lifecycle, and search query. Supports pagination and different view modes.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({
            ...entityListFiltersSchema.shape,
            ...z.object({
              limit: z.preprocess(
                v => (v !== undefined ? Number(v) : undefined),
                z
                  .number()
                  .int()
                  .positive()
                  .optional()
                  .describe('Maximum number of entities to return')
              ),
              offset: z.preprocess(
                v => (v !== undefined ? Number(v) : undefined),
                z
                  .number()
                  .int()
                  .min(0)
                  .optional()
                  .describe('Number of entities to skip for pagination')
              )
            }).shape,
            view: z
              .enum(['summary', 'full'])
              .optional()
              .describe('View mode (summary or full entity data)')
          })
        })
      )
      .output(entityListResponseSchema),
    count: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/count',
        inputStructure: 'detailed',
        summary: 'Count entities',
        description: 'Returns the total count of entities matching the specified filters.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          query: entityListFiltersSchema
        })
      )
      .output(entityCountResponseSchema),
    diff: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/diff',
        inputStructure: 'detailed',
        summary: 'Compare two reconstructed entity landscapes',
        description:
          'Returns entities added, removed, or changed between two reconstructed workspace states. ' +
          'Changed entries include raw field-level before/after values. Different project IDs are supported ' +
          'for workspace-wide scenario comparisons when both states use projectScope=all.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            from: entityLandscapeDiffStateSchema,
            to: entityLandscapeDiffStateSchema
          })
        })
      )
      .output(entityLandscapeDiffResponseSchema),
    facets: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/facets',
        inputStructure: 'detailed',
        summary: 'Get entity facets',
        description:
          'Retrieves faceted statistics about entities, including distribution by lifecycle, owner, schema, and completeness.',
        tags: ['Entities']
      })
      .input(z.object({ params: ws }))
      .output(entityFacetsSchema),
    timelineMarkers: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/timeline-markers',
        inputStructure: 'detailed',
        summary: 'Get timeline markers for point-in-time browsing',
        description:
          'Retrieves distinct dates with future_update target dates and saved_version promotions, for use as markers in the point-in-time snapshot date picker.',
        tags: ['Entities']
      })
      .input(z.object({ params: ws }))
      .output(z.array(timelineMarkerSchema)),
    timelineView: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/views/timeline',
        inputStructure: 'detailed',
        summary: 'Get batched timeline view data',
        description:
          'Retrieves version history and project change entries for multiple entities in one request.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({ ids: z.array(z.string()).max(200).describe('Entity identifiers') })
        })
      )
      .output(z.record(z.string(), timelineViewDataSchema)),
    tree: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/tree',
        inputStructure: 'detailed',
        summary: 'Get entity tree',
        description:
          'Retrieves entities as a tree structure based on containment relationships, with optional filtering.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          query: entityListFiltersSchema
        })
      )
      .output(treeResponseSchema),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}',
        inputStructure: 'detailed',
        summary: 'Get entity details',
        description:
          'Retrieves complete details for a specific entity, including all schema-defined fields and metadata.',
        tags: ['Entities']
      })
      .input(z.object({ params: wsAndId }))
      .output(entityRecordSchema),
    json: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/json',
        inputStructure: 'detailed',
        summary: 'Get entity JSON projection',
        description:
          'Retrieves an entity as a depth-limited JSON projection. Depth 1 includes direct relation targets.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({
            depth: z.preprocess(
              value => (value === undefined ? 1 : Number(value)),
              z.number().int().min(0).max(10).default(1)
            )
          })
        })
      )
      .output(z.record(z.string(), z.unknown())),
    relations: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/relations',
        inputStructure: 'detailed',
        summary: 'Get entity relationships',
        description: 'Retrieves all incoming and outgoing relationships for a specific entity.',
        tags: ['Entities']
      })
      .input(z.object({ params: wsAndId }))
      .output(entityRelationsSchema),
    batchRelations: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/batch-relations',
        inputStructure: 'detailed',
        summary: 'Get relationships for multiple entities',
        description:
          'Retrieves relationships for multiple entities in a single request. Returns a map of entity ID to relationships.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({ ids: z.array(z.string()).describe('Entity identifiers') })
        })
      )
      .output(z.record(z.string(), entityRelationsSchema)),
    dependents: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/dependents',
        inputStructure: 'detailed',
        summary: 'Get entity dependents',
        description:
          'Retrieves entities that depend on this entity, optionally including transitive dependents.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z
            .object({
              transitive: z
                .enum(['true', 'false'])
                .optional()
                .describe('Include transitive dependents'),
              maxDepth: z.string().optional().describe('Maximum traversal depth (default 5)')
            })
            .optional()
        })
      )
      .output(entityDependentsSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data',
        inputStructure: 'detailed',
        summary: 'Create entity',
        description: 'Creates a new entity with the specified schema and field values.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          body: entityMutationBodySchema
        })
      )
      .output(entityRecordSchema),
    bulkCreate: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/bulk',
        inputStructure: 'detailed',
        summary: 'Create multiple entities',
        description:
          'Creates a batch of entities transactionally and resolves symbolic references within the batch.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            entities: z.array(entityMutationBodySchema).describe('Entities to create')
          })
        })
      )
      .output(z.array(entityRecordSchema)),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/data/{id}',
        inputStructure: 'detailed',
        summary: 'Update entity',
        description:
          'Updates an existing entity with new field values. Only provided fields will be updated.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: wsAndId,
          body: entityMutationBodySchema
        })
      )
      .output(entityRecordSchema),
    clone: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/clone',
        inputStructure: 'detailed',
        summary: 'Clone entity',
        description:
          'Creates a copy of an existing entity with a new identifier. Relationships are not cloned.',
        tags: ['Entities']
      })
      .input(z.object({ params: wsAndId }))
      .output(entityRecordSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/data/{id}',
        inputStructure: 'detailed',
        summary: 'Delete entity',
        description: 'Permanently deletes an entity. This operation cannot be undone.',
        tags: ['Entities']
      })
      .input(z.object({ params: wsAndId }))
      .output(deleteEntityResponseSchema),
    getAccess: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/access',
        inputStructure: 'detailed',
        summary: 'Get entity access control',
        description:
          'Retrieves the access control configuration for an entity, including visibility mode and permission grants.',
        tags: ['Entities']
      })
      .input(z.object({ params: wsAndId }))
      .output(entityAccessSchema),
    updateAccess: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/data/{id}/access',
        inputStructure: 'detailed',
        summary: 'Update entity access control',
        description:
          'Updates the permission grants for an entity. This is a full replacement operation.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            grants: z.array(entityGrantInputSchema).describe('Complete list of permission grants'),
            approval_policy_override: z
              .enum(['required', 'disabled'])
              .nullable()
              .optional()
              .describe('Entity-specific approval policy override')
          })
        })
      )
      .output(entityAccessSchema),
    importParse: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/import/parse',
        inputStructure: 'detailed',
        summary: 'Parse entity import CSV',
        description:
          'Validates and parses a CSV file for entity import, identifying potential matches and conflicts.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            schemaId: z.string().describe('Schema identifier for the entities'),
            csvContent: z.string().describe('CSV file content')
          })
        })
      )
      .output(importParseResponseSchema),
    importCommit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/import/commit',
        inputStructure: 'detailed',
        summary: 'Commit entity import',
        description:
          'Executes the entity import, creating or updating entities based on the parsed data.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            schemaId: z.string().describe('Schema identifier'),
            entities: z.array(z.record(z.string(), z.unknown())).describe('Entity data to import')
          })
        })
      )
      .output(importCommitResponseSchema),
    exportCsv: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/export',
        inputStructure: 'detailed',
        outputStructure: 'detailed',
        summary: 'Export entities to CSV',
        description: 'Exports entities matching the specified filters to a CSV file.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: ws,
          query: entityListFiltersSchema
        })
      )
      .output(
        z.object({
          headers: z
            .record(z.string(), z.string())
            .describe('Response headers including Content-Disposition'),
          body: z.instanceof(Blob).describe('CSV file as binary blob')
        })
      ),
    downloadTemplate: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/import/template/{schemaId}',
        inputStructure: 'detailed',
        outputStructure: 'detailed',
        summary: 'Download import template',
        description: 'Downloads a CSV template file for importing entities of a specific schema.',
        tags: ['Entities']
      })
      .input(
        z.object({
          params: z.object({
            workspace: z.string().describe('Workspace identifier'),
            schemaId: z.string().describe('Schema identifier')
          })
        })
      )
      .output(
        z.object({
          headers: z
            .record(z.string(), z.string())
            .describe('Response headers including Content-Disposition'),
          body: z.instanceof(Blob).describe('CSV template as binary blob')
        })
      )
  }
});

export type EntityLink = z.infer<typeof entityLinkSchema>;
export type RelationDeltas = z.infer<typeof relationDeltasSchema>;
export type RelationFieldDelta = RelationDeltas[string];
export type RelationRecordDraft = z.infer<typeof relationRecordDraftSchema>;
export type RelationRecordUpdateDraft = z.infer<typeof relationRecordUpdateDraftSchema>;
export type EntitySummary = z.infer<typeof entitySummarySchema>;
export type EntityRecord = z.infer<typeof entityRecordSchema>;
export type EntityFacets = z.infer<typeof entityFacetsSchema>;
export type EntityRelation = z.infer<typeof entityRelationSchema>;
export type EntityRelations = z.infer<typeof entityRelationsSchema>;
export type EntityDependent = z.infer<typeof entityDependentSchema>;
export type EntityDependents = z.infer<typeof entityDependentsSchema>;
export type TreeResponse = z.infer<typeof treeResponseSchema>;
export type TreeNode = TreeResponse['nodes'][number];
export type TreeEdge = TreeResponse['edges'][number];
export type TimelineMarker = z.infer<typeof timelineMarkerSchema>;
export type EntityQueryParseError = z.infer<typeof entityQueryParseErrorSchema>;
export type EntityQueryParseResult = z.infer<typeof entityQueryParseResultSchema>;
export type TimelineViewData = z.infer<typeof timelineViewDataSchema>;
export type TimelineVersion = z.infer<typeof timelineVersionSchema>;
export type TimelineChangeCaseMember = z.infer<typeof timelineChangeCaseMemberSchema>;
export type TimelineProjectChange = z.infer<typeof timelineProjectChangeSchema>;
export type EntityLandscapeDiffState = z.infer<typeof entityLandscapeDiffStateSchema>;
export type EntityLandscapeDiff = z.infer<typeof entityLandscapeDiffResponseSchema>;

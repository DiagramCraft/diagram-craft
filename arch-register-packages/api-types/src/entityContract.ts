import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId, foreignKeySchema, UUID_REGEX } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

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

const visibilityModeSchema = z.enum(['public', 'restricted']);

const entitySummarySchema = entityCapabilitiesSchema.extend({
  _uid: z.string(),
  _publicId: z.string(),
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
  _visibilityMode: visibilityModeSchema.nullable(),
  _completeness: z.number().nullable()
});

// EntityRecord = EntitySummary + dynamic schema fields
const entityRecordSchema = entitySummarySchema.catchall(z.unknown());

// ── Mutation input ────────────────────────────────────────────

const ownerOrIdSchema = z
  .union([z.string(), z.object({ id: z.string() }).passthrough()])
  .nullable()
  .optional();

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

const deleteEntityResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

// ── Facets ────────────────────────────────────────────────────

const entityFacetBucketSchema = z.object({
  label: z.string(),
  value: z.string().nullable(),
  count: z.number().int()
});

const entityFacetsSchema = z.object({
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

const treeResponseSchema = z.object({
  nodes: z.array(entitySummarySchema.extend({ _isMatch: z.boolean() })),
  edges: z.array(z.object({ childId: z.string(), parentId: z.string() }))
});

// ── Relations ─────────────────────────────────────────────────

const entityRelationSchema = z.object({
  entityId: z.string(),
  publicId: z.string(),
  entitySlug: z.string(),
  entityName: z.string(),
  entitySchemaId: z.string(),
  fieldName: z.string(),
  kind: z.enum(['reference', 'containment'])
});

const entityRelationsSchema = z.object({
  outgoing: z.array(entityRelationSchema),
  incoming: z.array(entityRelationSchema)
});

// ── Entity Access ─────────────────────────────────────────────

const entityGrantSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  entity_id: z.string(),
  principal_type: z.enum(['user', 'team']),
  principal_id: z.string(),
  role: z.enum(['viewer', 'editor', 'contributor', 'entity_admin']),
  applies_to: z.enum(['self', 'subtree']),
  created_at: z.string()
});

const entityGrantInputSchema = z.object({
  principal_type: z.enum(['user', 'team']),
  principal_id: z.string(),
  role: z.enum(['viewer', 'editor', 'contributor', 'entity_admin']),
  applies_to: z.enum(['self', 'subtree'])
});

const entityAccessSchema = z.object({
  owner: z.string().nullable(),
  visibility_mode: z.enum(['public', 'restricted']).nullable(),
  grants: z.array(entityGrantSchema)
});

// ── Snapshots ─────────────────────────────────────────────────

const entitySnapshotSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  entity_id: z.string(),
  status: z.enum(['autosave', 'saved_version', 'future_update', 'applied']),
  project_id: z.string().nullable(),
  target_date: z.string().nullable(),
  commit_message: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  base_state: z.record(z.string(), z.unknown()),
  proposed_state: z.record(z.string(), z.unknown()).nullable()
});

// ── Import ────────────────────────────────────────────────────

const importNameMatchSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  name: z.string(),
  slug: z.string(),
  namespace: z.string()
});

const importConstraintViolationSchema = z.object({
  type: z.enum(['duplicate_slug', 'wrong_workspace', 'wrong_schema']),
  message: z.string()
});

const importEntityRowSchema = z.object({
  rowNumber: z.number(),
  errors: z.array(z.string()),
  entity: z.record(z.string(), z.unknown()).nullable(),
  isUpdate: z.boolean(),
  matchType: z.enum(['id', 'slug', 'name', 'none']),
  nameMatches: z.array(importNameMatchSchema),
  existingId: z.string().nullable().optional(),
  existingEntity: z.record(z.string(), z.unknown()).nullable(),
  constraintViolations: z.array(importConstraintViolationSchema).optional()
});

const importParseResponseSchema = z.object({
  schemaId: z.string(),
  schemaName: z.string(),
  totalRows: z.number(),
  validRows: z.number(),
  entities: z.array(importEntityRowSchema)
});

const importCommitResponseSchema = z.object({
  created: z.number(),
  updated: z.number(),
  ids: z.array(z.string())
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceEntityContract = {
  entities: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/data', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          query: z.object({
            ...listFiltersSchema.shape,
            ...z.object({
              limit: z.preprocess(
                v => (v !== undefined ? Number(v) : undefined),
                z.number().int().positive().optional()
              ),
              offset: z.preprocess(
                v => (v !== undefined ? Number(v) : undefined),
                z.number().int().min(0).optional()
              )
            }).shape,
            view: z.enum(['summary', 'full']).optional()
          })
        })
      )
      .output(z.array(entityRecordSchema)),
    facets: oc
      .route({ method: 'GET', path: '/{workspace}/data/facets', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(entityFacetsSchema),
    tree: oc
      .route({ method: 'GET', path: '/{workspace}/data/tree', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          query: listFiltersSchema
        })
      )
      .output(treeResponseSchema),
    get: oc
      .route({ method: 'GET', path: '/{workspace}/data/{id}', inputStructure: 'detailed' })
      .input(z.object({ params: wsAndId }))
      .output(entityRecordSchema),
    relations: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/relations',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: wsAndId }))
      .output(entityRelationsSchema),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/data', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: entityMutationBodySchema
        })
      )
      .output(entityRecordSchema),
    update: oc
      .route({ method: 'PUT', path: '/{workspace}/data/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndId,
          body: entityMutationBodySchema
        })
      )
      .output(entityRecordSchema),
    clone: oc
      .route({ method: 'POST', path: '/{workspace}/data/{id}/clone', inputStructure: 'detailed' })
      .input(z.object({ params: wsAndId }))
      .output(entityRecordSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/data/{id}', inputStructure: 'detailed' })
      .input(z.object({ params: wsAndId }))
      .output(deleteEntityResponseSchema),
    getAccess: oc
      .route({ method: 'GET', path: '/{workspace}/data/{id}/access', inputStructure: 'detailed' })
      .input(z.object({ params: wsAndId }))
      .output(entityAccessSchema),
    updateAccess: oc
      .route({ method: 'PUT', path: '/{workspace}/data/{id}/access', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            grants: z.array(entityGrantInputSchema)
          })
        })
      )
      .output(entityAccessSchema),
    importParse: oc
      .route({ method: 'POST', path: '/{workspace}/data/import/parse', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({
            schemaId: z.string(),
            csvContent: z.string()
          })
        })
      )
      .output(importParseResponseSchema),
    importCommit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/import/commit',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            schemaId: z.string(),
            entities: z.array(z.record(z.string(), z.unknown()))
          })
        })
      )
      .output(importCommitResponseSchema),
    exportCsv: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/export',
        inputStructure: 'detailed',
        outputStructure: 'detailed'
      })
      .input(
        z.object({
          params: ws,
          query: listFiltersSchema
        })
      )
      .output(
        z.object({
          headers: z.record(z.string(), z.string()),
          body: z.instanceof(Blob)
        })
      ),
    downloadTemplate: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/import/template/{schemaId}',
        inputStructure: 'detailed',
        outputStructure: 'detailed'
      })
      .input(
        z.object({
          params: z.object({
            workspace: z.string(),
            schemaId: z.string()
          })
        })
      )
      .output(
        z.object({
          headers: z.record(z.string(), z.string()),
          body: z.instanceof(Blob)
        })
      ),
    snapshots: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/data/{id}/snapshots',
          inputStructure: 'detailed'
        })
        .input(z.object({ params: wsAndId }))
        .output(z.array(entitySnapshotSchema)),
      listByProject: oc
        .route({
          method: 'GET',
          path: '/{workspace}/data/snapshots/by-project/{projectId}',
          inputStructure: 'detailed'
        })
        .input(z.object({ params: z.object({ workspace: z.string(), projectId: z.string() }) }))
        .output(z.array(entitySnapshotSchema)),
      create: oc
        .route({
          method: 'POST',
          path: '/{workspace}/data/{id}/snapshots',
          inputStructure: 'detailed'
        })
        .input(
          z.object({
            params: wsAndId,
            body: z.object({
              projectId: z.string(),
              targetDate: z.string().nullable().optional(),
              commitMessage: z.string().nullable().optional(),
              proposedState: z.record(z.string(), z.unknown())
            })
          })
        )
        .output(entitySnapshotSchema),
      update: oc
        .route({
          method: 'PUT',
          path: '/{workspace}/data/{id}/snapshots/{snapshotId}',
          inputStructure: 'detailed'
        })
        .input(
          z.object({
            params: z.object({ workspace: z.string(), id: z.string().regex(UUID_REGEX), snapshotId: z.string().regex(UUID_REGEX) }),
            body: z.object({
              proposedState: z.record(z.string(), z.unknown()).optional(),
              targetDate: z.string().nullable().optional(),
              commitMessage: z.string().nullable().optional()
            })
          })
        )
        .output(entitySnapshotSchema),
      promote: oc
        .route({
          method: 'POST',
          path: '/{workspace}/data/{id}/snapshots/{snapshotId}/promote',
          inputStructure: 'detailed'
        })
        .input(
          z.object({
            params: z.object({ workspace: z.string(), id: z.string().regex(UUID_REGEX), snapshotId: z.string().regex(UUID_REGEX) }),
            body: z.object({ commitMessage: z.string().optional() })
          })
        )
        .output(entitySnapshotSchema),
      apply: oc
        .route({
          method: 'POST',
          path: '/{workspace}/data/{id}/snapshots/{snapshotId}/apply',
          inputStructure: 'detailed'
        })
        .input(
          z.object({
            params: z.object({ workspace: z.string(), id: z.string().regex(UUID_REGEX), snapshotId: z.string().regex(UUID_REGEX) }),
            body: z.object({
              resolvedEntityData: z.record(z.string(), z.unknown())
            })
          })
        )
        .output(entitySnapshotSchema)
    }
  }
};

export type EntityLink = z.infer<typeof entityLinkSchema>;
export type VisibilityMode = z.infer<typeof visibilityModeSchema>;
export type EntitySummary = z.infer<typeof entitySummarySchema>;
export type EntityRecord = z.infer<typeof entityRecordSchema>;
export type EntityFacets = z.infer<typeof entityFacetsSchema>;
export type EntityRelations = z.infer<typeof entityRelationsSchema>;
export type TreeResponse = z.infer<typeof treeResponseSchema>;
export type EntitySnapshot = z.infer<typeof entitySnapshotSchema>;

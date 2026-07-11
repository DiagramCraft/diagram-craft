import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId, foreignKeySchema, UUID_REGEX } from '@arch-register/api-types/common';

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

const entityCapabilitiesSchema = z.object({
  canView: z.boolean().describe('Whether the user can view this entity'),
  canEdit: z.boolean().describe('Whether the user can edit this entity'),
  canDelete: z.boolean().describe('Whether the user can delete this entity'),
  canAdmin: z.boolean().describe('Whether the user can manage entity permissions'),
  canCreateChild: z.boolean().describe('Whether the user can create child entities')
});

const visibilityModeSchema = z.enum(['public', 'restricted']).describe('Entity visibility mode');

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
  _targetLifecycleDate: z.string().nullable().describe('Target date for lifecycle transition (ISO 8601)'),
  _tags: z.array(z.string()).describe('Entity tags'),
  _links: z.array(entityLinkSchema).describe('External links associated with the entity'),
  _updatedAt: z.string().optional().describe('ISO 8601 timestamp of the entity\'s most recent update'),
  _visibilityMode: visibilityModeSchema.nullable().describe('Entity visibility mode'),
  _completeness: z.number().nullable().describe('Field completeness percentage (0-100)'),
  _projectLink: projectLinkSchema.optional().describe('Project linkage information')
});

// EntityRecord = EntitySummary + dynamic schema fields
const entityRecordSchema = entitySummarySchema.catchall(z.unknown()).describe('Complete entity record with schema-specific fields');

// ── Mutation input ────────────────────────────────────────────

const ownerOrIdSchema = z
  .union([z.string(), z.object({ id: z.string() }).passthrough()])
  .nullable()
  .optional()
  .describe('Owner reference (ID string or object with id)');

const entityMutationBodySchema = z
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
    _targetLifecycleDate: z.string().nullable().optional().describe('Target date for lifecycle transition (ISO 8601)'),
    _tags: z.array(z.string()).optional().describe('Entity tags'),
    _links: z.array(entityLinkSchema).optional().describe('External links'),
    _visibilityMode: z.enum(['public', 'restricted']).nullable().optional().describe('Entity visibility mode')
  })
  .catchall(z.unknown())
  .describe('Entity mutation data with schema-specific fields');

// ── Query / filter input ──────────────────────────────────────

const listFiltersSchema = z.object({
  _schemaId: z.string().optional().describe('Filter by schema identifier'),
  owner: z.string().optional().describe('Filter by owner identifier'),
  lifecycle: z.string().optional().describe('Filter by lifecycle state'),
  q: z.string().optional().describe('Search query string'),
  conditions: z.string().optional().describe('JSON-encoded filter conditions'),
  assessmentId: z.string().optional().describe('Joined assessment identifier — required when conditions reference assessment fields'),
  projectId: z.string().optional().describe('Filter by project identifier'),
  projectScope: z.enum(['project', 'all']).optional().describe('Project scope filter'),
  asOf: z
    .string()
    .optional()
    .describe(
      'ISO 8601 date/time — if set, return entities reconstructed as they existed/will exist at this point in time (read-only snapshot mode)'
    ),
  includeProjectSnapshots: z
    .enum(['true', 'false'])
    .optional()
    .describe(
      'When asOf is set, whether to apply future_update snapshots planned under projects on top of the reconstructed state. Defaults to true.'
    )
});

const deleteEntityResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

const entityCountResponseSchema = z.object({
  total: z.number().int().describe('Total number of entities matching the filters')
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

const entityFacetsSchema = z.object({
  total: z.number().int().describe('Total number of entities'),
  lifecycle: z.array(entityFacetBucketSchema).describe('Lifecycle state distribution'),
  owner: z.array(entityFacetBucketSchema).describe('Owner distribution'),
  schema: z.array(z.object({
    schemaId: z.string().describe('Schema identifier'),
    count: z.number().int().describe('Number of entities')
  })).describe('Schema distribution'),
  completeness: z.object({
    below50: z.number().int().describe('Entities with <50% fields filled'),
    below80: z.number().int().describe('Entities with 50-79% fields filled'),
    above80: z.number().int().describe('Entities with ≥80% fields filled')
  }).describe('Field completeness distribution')
});

// ── Tree ──────────────────────────────────────────────────────

const treeResponseSchema = z.object({
  nodes: z.array(entityRecordSchema.extend({
    _isMatch: z.boolean().describe('Whether this node matches the search criteria')
  })).describe('Tree nodes'),
  edges: z.array(z.object({
    childId: z.string().describe('Child entity identifier'),
    parentId: z.string().describe('Parent entity identifier')
  })).describe('Parent-child relationships')
});

// ── Relations ─────────────────────────────────────────────────

const entityRelationSchema = z.object({
  entityId: z.string().describe('Related entity identifier'),
  publicId: z.string().describe('Related entity public identifier'),
  entitySlug: z.string().describe('Related entity URL slug'),
  entityName: z.string().describe('Related entity name'),
  entitySchemaId: z.string().describe('Related entity schema identifier'),
  fieldName: z.string().describe('Relationship field name'),
  fieldPredicate: z.string().optional().describe('Relationship predicate/label'),
  kind: z.enum(['reference', 'containment']).describe('Relationship type')
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
  viaPath: z.array(viaNodeSchema).describe('Chain of intermediate entities from the root to this dependent')
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
  role: z.enum(['viewer', 'editor', 'contributor', 'entity_admin']).describe('Granted role'),
  applies_to: z.enum(['self', 'subtree']).describe('Grant scope (entity only or including children)'),
  created_at: z.string().describe('ISO 8601 creation timestamp')
});

const entityGrantInputSchema = z.object({
  principal_type: z.enum(['user', 'team']).describe('Principal type (user or team)'),
  principal_id: z.string().describe('Principal identifier'),
  role: z.enum(['viewer', 'editor', 'contributor', 'entity_admin']).describe('Role to grant'),
  applies_to: z.enum(['self', 'subtree']).describe('Grant scope (entity only or including children)')
});

const entityAccessSchema = z.object({
  owner: z.string().nullable().describe('Entity owner identifier'),
  visibility_mode: z.enum(['public', 'restricted']).nullable().describe('Entity visibility mode'),
  grants: z.array(entityGrantSchema).describe('Permission grants for this entity')
});

// ── Snapshots ─────────────────────────────────────────────────

const entitySnapshotSchema = z.object({
  id: z.string().describe('Snapshot identifier'),
  workspace: z.string().describe('Workspace identifier'),
  entity_id: z.string().describe('Entity identifier'),
  status: z
    .enum(['autosave', 'saved_version', 'future_update', 'applied', 'deleted'])
    .describe('Snapshot status'),
  project_id: z.string().nullable().describe('Associated project identifier'),
  target_date: z.string().nullable().describe('Target date for future update (ISO 8601)'),
  commit_message: z.string().nullable().describe('Commit message describing the changes'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  created_by: z.string().describe('User who created the snapshot'),
  created_by_name: z.string().nullable().describe('Display name of creator'),
  base_state: z.record(z.string(), z.unknown()).describe('Entity state at snapshot creation'),
  proposed_state: z.record(z.string(), z.unknown()).nullable().describe('Proposed changes (for future updates)')
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
  existingEntity: z.record(z.string(), z.unknown()).nullable().describe('Existing entity data if matched'),
  constraintViolations: z.array(importConstraintViolationSchema).optional().describe('Constraint violations')
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

export const workspaceEntityContract = oc
  .tag('Entities')
  .router({
    entities: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/data',
          inputStructure: 'detailed',
          summary: 'List entities',
          description: 'Retrieves entities with optional filtering by schema, owner, lifecycle, and search query. Supports pagination and different view modes.',
          tags: ['Entities']
        })
        .input(
          z.object({
            params: ws,
            query: z.object({
              ...listFiltersSchema.shape,
              ...z.object({
                limit: z.preprocess(
                  v => (v !== undefined ? Number(v) : undefined),
                  z.number().int().positive().optional().describe('Maximum number of entities to return')
                ),
                offset: z.preprocess(
                  v => (v !== undefined ? Number(v) : undefined),
                  z.number().int().min(0).optional().describe('Number of entities to skip for pagination')
                )
              }).shape,
              view: z.enum(['summary', 'full']).optional().describe('View mode (summary or full entity data)')
            })
          })
        )
        .output(z.array(entityRecordSchema)),
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
            query: listFiltersSchema
          })
        )
        .output(entityCountResponseSchema),
      facets: oc
        .route({
          method: 'GET',
          path: '/{workspace}/data/facets',
          inputStructure: 'detailed',
          summary: 'Get entity facets',
          description: 'Retrieves faceted statistics about entities, including distribution by lifecycle, owner, schema, and completeness.',
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
          description: 'Retrieves distinct dates with future_update target dates and saved_version promotions, for use as markers in the point-in-time snapshot date picker.',
          tags: ['Entities']
        })
        .input(z.object({ params: ws }))
        .output(z.array(timelineMarkerSchema)),
      tree: oc
        .route({
          method: 'GET',
          path: '/{workspace}/data/tree',
          inputStructure: 'detailed',
          summary: 'Get entity tree',
          description: 'Retrieves entities as a tree structure based on containment relationships, with optional filtering.',
          tags: ['Entities']
        })
        .input(
          z.object({
            params: ws,
            query: listFiltersSchema
          })
        )
        .output(treeResponseSchema),
      get: oc
        .route({
          method: 'GET',
          path: '/{workspace}/data/{id}',
          inputStructure: 'detailed',
          summary: 'Get entity details',
          description: 'Retrieves complete details for a specific entity, including all schema-defined fields and metadata.',
          tags: ['Entities']
        })
        .input(z.object({ params: wsAndId }))
        .output(entityRecordSchema),
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
          description: 'Retrieves relationships for multiple entities in a single request. Returns a map of entity ID to relationships.',
          tags: ['Entities']
        })
        .input(z.object({
          params: ws,
          body: z.object({ ids: z.array(z.string()).describe('Entity identifiers') })
        }))
        .output(z.record(z.string(), entityRelationsSchema)),
      dependents: oc
        .route({
          method: 'GET',
          path: '/{workspace}/data/{id}/dependents',
          inputStructure: 'detailed',
          summary: 'Get entity dependents',
          description: 'Retrieves entities that depend on this entity, optionally including transitive dependents.',
          tags: ['Entities']
        })
        .input(z.object({
          params: wsAndId,
          query: z.object({
            transitive: z.enum(['true', 'false']).optional().describe('Include transitive dependents'),
            maxDepth: z.string().optional().describe('Maximum traversal depth (default 5)')
          }).optional()
        }))
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
      update: oc
        .route({
          method: 'PUT',
          path: '/{workspace}/data/{id}',
          inputStructure: 'detailed',
          summary: 'Update entity',
          description: 'Updates an existing entity with new field values. Only provided fields will be updated.',
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
          description: 'Creates a copy of an existing entity with a new identifier. Relationships are not cloned.',
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
          description: 'Retrieves the access control configuration for an entity, including visibility mode and permission grants.',
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
          description: 'Updates the permission grants for an entity. This is a full replacement operation.',
          tags: ['Entities']
        })
        .input(
          z.object({
            params: wsAndId,
            body: z.object({
              grants: z.array(entityGrantInputSchema).describe('Complete list of permission grants')
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
          description: 'Validates and parses a CSV file for entity import, identifying potential matches and conflicts.',
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
          description: 'Executes the entity import, creating or updating entities based on the parsed data.',
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
            query: listFiltersSchema
          })
        )
        .output(
          z.object({
            headers: z.record(z.string(), z.string()).describe('Response headers including Content-Disposition'),
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
            headers: z.record(z.string(), z.string()).describe('Response headers including Content-Disposition'),
            body: z.instanceof(Blob).describe('CSV template as binary blob')
          })
        ),
      snapshots: {
        list: oc
          .route({
            method: 'GET',
            path: '/{workspace}/data/{id}/snapshots',
            inputStructure: 'detailed',
            summary: 'List entity snapshots',
            description: 'Retrieves all snapshots for a specific entity, including autosaves, saved versions, and future updates.',
            tags: ['Entities']
          })
          .input(z.object({ params: wsAndId }))
          .output(z.array(entitySnapshotSchema)),
        listByProject: oc
          .route({
            method: 'GET',
            path: '/{workspace}/data/snapshots/by-project/{projectId}',
            inputStructure: 'detailed',
            summary: 'List snapshots by project',
            description: 'Retrieves all entity snapshots associated with a specific project.',
            tags: ['Entities']
          })
          .input(z.object({ params: z.object({ workspace: z.string(), projectId: z.string() }) }))
          .output(z.array(entitySnapshotSchema)),
        create: oc
          .route({
            method: 'POST',
            path: '/{workspace}/data/{id}/snapshots',
            inputStructure: 'detailed',
            summary: 'Create entity snapshot',
            description: 'Creates a new snapshot of an entity, optionally with proposed changes for future updates.',
            tags: ['Entities']
          })
          .input(
            z.object({
              params: wsAndId,
              body: z.object({
                projectId: z.string().describe('Associated project identifier'),
                targetDate: z.string().nullable().optional().describe('Target date for future update (ISO 8601)'),
                commitMessage: z.string().nullable().optional().describe('Commit message'),
                proposedState: z.record(z.string(), z.unknown()).describe('Proposed entity state')
              })
            })
          )
          .output(entitySnapshotSchema),
        update: oc
          .route({
            method: 'PUT',
            path: '/{workspace}/data/{id}/snapshots/{snapshotId}',
            inputStructure: 'detailed',
            summary: 'Update entity snapshot',
            description: 'Updates an existing snapshot with new proposed changes or metadata.',
            tags: ['Entities']
          })
          .input(
            z.object({
              params: z.object({
                workspace: z.string(),
                id: z.string().regex(UUID_REGEX),
                snapshotId: z.string().regex(UUID_REGEX)
              }),
              body: z.object({
                proposedState: z.record(z.string(), z.unknown()).optional().describe('Updated proposed state'),
                targetDate: z.string().nullable().optional().describe('Updated target date (ISO 8601)'),
                commitMessage: z.string().nullable().optional().describe('Updated commit message')
              })
            })
          )
          .output(entitySnapshotSchema),
        promote: oc
          .route({
            method: 'POST',
            path: '/{workspace}/data/{id}/snapshots/{snapshotId}/promote',
            inputStructure: 'detailed',
            summary: 'Promote snapshot to saved version',
            description: 'Promotes an autosave snapshot to a saved version, making it permanent.',
            tags: ['Entities']
          })
          .input(
            z.object({
              params: z.object({ workspace: z.string(), id: z.string(), snapshotId: z.string().regex(UUID_REGEX) }),
              body: z.object({ commitMessage: z.string().optional().describe('Commit message for the saved version') })
            })
          )
          .output(entitySnapshotSchema),
        apply: oc
          .route({
            method: 'POST',
            path: '/{workspace}/data/{id}/snapshots/{snapshotId}/apply',
            inputStructure: 'detailed',
            summary: 'Apply snapshot changes',
            description: 'Applies the proposed changes from a snapshot to the entity, updating its current state.',
            tags: ['Entities']
          })
          .input(
            z.object({
              params: z.object({ workspace: z.string(), id: z.string(), snapshotId: z.string().regex(UUID_REGEX) }),
              body: z.object({
                resolvedEntityData: z.record(z.string(), z.unknown()).describe('Resolved entity data to apply')
              })
            })
          )
          .output(entitySnapshotSchema),
        restore: oc
          .route({
            method: 'POST',
            path: '/{workspace}/data/{id}/snapshots/{snapshotId}/restore',
            inputStructure: 'detailed',
            summary: 'Restore entity from snapshot',
            description: 'Restores an entity to a previous state from a snapshot, creating a new snapshot in the process.',
            tags: ['Entities']
          })
          .input(
            z.object({
              params: z.object({ workspace: z.string(), id: z.string(), snapshotId: z.string().regex(UUID_REGEX) }),
              body: z.object({ commitMessage: z.string().optional().describe('Commit message for the restore operation') })
            })
          )
          .output(entitySnapshotSchema)
      }
    }
  });

export type EntityLink = z.infer<typeof entityLinkSchema>;
export type VisibilityMode = z.infer<typeof visibilityModeSchema>;
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
export type EntitySnapshot = z.infer<typeof entitySnapshotSchema>;
export type TimelineMarker = z.infer<typeof timelineMarkerSchema>;

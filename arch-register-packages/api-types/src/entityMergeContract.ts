import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';
import { entityRecordSchema } from '@arch-register/api-types/entityContract';

// A single field whose value differs between the merged-away source and the canonical target.
// `source` / `target` carry the two values; when `restricted` is true the caller cannot view
// the field's group and the values are withheld (both null) rather than leaked.
const mergeFieldConflictSchema = z.object({
  // `core:<mutable key>` or `data:<schema field id>`; restricted data fields use an opaque
  // `data:<fingerprint>` key so their schema field id is not disclosed. fieldName is display-only.
  fieldKey: z.string(),
  fieldName: z.string(),
  kind: z.enum(['core', 'data']),
  source: z.unknown(),
  target: z.unknown(),
  restricted: z.boolean()
});

// A reverse reference that currently points at the source and would be re-pointed to the target.
const mergeDependentImpactSchema = z.object({
  entityId: z.string(),
  entityName: z.string(),
  entitySlug: z.string(),
  entitySchemaId: z.string(),
  schemaName: z.string(),
  ownerTeamId: z.string().nullable(),
  fieldName: z.string(),
  kind: z.enum(['reference', 'containment', 'typed'])
});

// A relation instance on the source that, after its source endpoint is re-pointed to the target,
// would either collapse to a self-relation or duplicate an existing target relation.
const mergeRelationConflictSchema = z.object({
  relationId: z.string(),
  relationSchemaId: z.string(),
  relationSchemaName: z.string(),
  direction: z.enum(['in', 'out']),
  otherRecordId: z.string(),
  otherRecordName: z.string(),
  duplicateRelationId: z.string().nullable(),
  note: z.enum(['duplicate', 'self'])
});

const mergeSideTableConflictSchema = z.object({
  conflictId: z.string(),
  table: z.enum([
    'entity_grant',
    'content_node',
    'content_mount',
    'diagram_entity_ref',
    'user_watch',
    'user_notification',
    'user_pinned_entity',
    'user_collection_entity',
    'project_entity',
    'assessment_response',
    'document_link_index',
    'record_change_case_record_version',
    'entity_deprecation_ack',
    'catalog_artifact',
    'conformance_violation',
    'conformance_entity_evaluation'
  ]),
  sourceRowId: z.string().nullable(),
  targetRowId: z.string().nullable(),
  // Opaque, stable identity for the unique key being collided with. It contains no row data.
  key: z.string()
});

const mergeBlockerSchema = z.object({
  code: z.enum([
    'not_found',
    'same_entity',
    'source_is_alias',
    'target_is_alias',
    'different_schema',
    'project_scope_mismatch',
    'restricted_field_write',
    'open_governance_case',
    'external_identity',
    'truncated_dependents'
  ]),
  message: z.string()
});

const mergePreviewSchema = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  sourceVersion: z.number().int().min(1),
  targetVersion: z.number().int().min(1),
  previewFingerprint: z.string(),
  fieldConflicts: z.array(mergeFieldConflictSchema),
  dependentImpact: z.array(mergeDependentImpactSchema),
  relationConflicts: z.array(mergeRelationConflictSchema),
  sideTableConflicts: z.array(mergeSideTableConflictSchema),
  sideTableCounts: z.object({
    entityVersions: z.number().int(),
    openChangeApprovals: z.number().int(),
    openGovernanceCases: z.number().int(),
    incomingRelations: z.number().int(),
    outgoingRelations: z.number().int()
  }),
  blockers: z.array(mergeBlockerSchema),
  // True when the dependent-impact graph hit its traversal ceiling and the list is partial.
  truncated: z.boolean()
});

const mergePreviewBodySchema = z.object({
  targetId: z.string().min(1)
});

const mergeExecuteBodySchema = z.object({
  targetId: z.string().min(1),
  expectedSourceVersion: z.number().int().min(1),
  expectedTargetVersion: z.number().int().min(1),
  previewFingerprint: z.string().min(1),
  fieldResolutions: z
    .record(z.string(), z.enum(['source', 'target']))
    .default({})
    .describe('Resolved field choices keyed by the preview field key'),
  relationResolutions: z
    .record(z.string(), z.enum(['keep_source', 'keep_target', 'drop_source']))
    .default({})
    .describe('Resolved typed-relation conflicts keyed by source relation id'),
  sideTableResolutions: z
    .record(z.string(), z.enum(['keep_source', 'keep_target', 'drop_source']))
    .default({})
    .describe('Resolved side-table collisions keyed by preview conflict id')
});

const mergeExecuteResponseSchema = z.object({
  mergeId: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  entity: entityRecordSchema
});

export const entityMergeContract = oc.tag('Entity merge').router({
  entityMerges: {
    preview: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/merge/preview',
        inputStructure: 'detailed',
        summary: 'Preview what a proposed entity merge would touch',
        tags: ['Entity merge']
      })
      .input(z.object({ params: wsAndId, body: mergePreviewBodySchema }))
      .output(mergePreviewSchema),
    execute: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/merge',
        inputStructure: 'detailed',
        summary: 'Execute an entity merge atomically',
        description:
          'Repoints references to the target, preserves merge history, retires the source, and returns the canonical entity.',
        tags: ['Entity merge']
      })
      .input(z.object({ params: wsAndId, body: mergeExecuteBodySchema }))
      .output(mergeExecuteResponseSchema)
  }
});

export type MergeFieldConflict = z.infer<typeof mergeFieldConflictSchema>;
export type MergeDependentImpact = z.infer<typeof mergeDependentImpactSchema>;
export type MergeRelationConflict = z.infer<typeof mergeRelationConflictSchema>;
export type MergeSideTableConflict = z.infer<typeof mergeSideTableConflictSchema>;
export type MergeBlocker = z.infer<typeof mergeBlockerSchema>;
export type MergePreview = z.infer<typeof mergePreviewSchema>;
export type MergePreviewBody = z.infer<typeof mergePreviewBodySchema>;
export type MergeExecuteBody = z.infer<typeof mergeExecuteBodySchema>;
export type MergeExecuteResponse = z.infer<typeof mergeExecuteResponseSchema>;

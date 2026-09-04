import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';

// A single field whose value differs between the merged-away source and the canonical target.
// `source` / `target` carry the two values; when `restricted` is true the caller cannot view
// the field's group and the values are withheld (both null) rather than leaked.
const mergeFieldConflictSchema = z.object({
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
  note: z.enum(['duplicate', 'self'])
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
    'open_governance_case'
  ]),
  message: z.string()
});

const mergePreviewSchema = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  fieldConflicts: z.array(mergeFieldConflictSchema),
  dependentImpact: z.array(mergeDependentImpactSchema),
  relationConflicts: z.array(mergeRelationConflictSchema),
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
      .output(mergePreviewSchema)
  }
});

export type MergeFieldConflict = z.infer<typeof mergeFieldConflictSchema>;
export type MergeDependentImpact = z.infer<typeof mergeDependentImpactSchema>;
export type MergeRelationConflict = z.infer<typeof mergeRelationConflictSchema>;
export type MergeBlocker = z.infer<typeof mergeBlockerSchema>;
export type MergePreview = z.infer<typeof mergePreviewSchema>;
export type MergePreviewBody = z.infer<typeof mergePreviewBodySchema>;

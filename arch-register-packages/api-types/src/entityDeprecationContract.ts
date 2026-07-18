import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';

const deprecationImpactEntrySchema = z.object({
  entityId: z.string(),
  entityName: z.string(),
  entitySlug: z.string(),
  entitySchemaId: z.string(),
  schemaName: z.string(),
  ownerTeamId: z.string().nullable(),
  fieldName: z.string(),
  kind: z.enum(['reference', 'containment'])
});

const deprecationAckSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  ownerTeamId: z.string(),
  affectedEntityIds: z.array(z.string()),
  status: z.enum(['open', 'completed']),
  assignmentId: z.string(),
  actorUserId: z.string().nullable(),
  comment: z.string().nullable(),
  plannedRemediation: z.string().nullable(),
  remediationProjectId: z.string().nullable(),
  targetRemediationDate: z.string().nullable(),
  riskAccepted: z.boolean(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable()
});

const deprecationCaseStatusSchema = z.enum(['open', 'completed', 'cancelled']);
const deprecationPhaseSchema = z.enum(['pending_approval', 'scheduled']);

const deprecationCaseSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  entityId: z.string(),
  status: deprecationCaseStatusSchema,
  phase: deprecationPhaseSchema,
  outcome: z.string().nullable(),
  reason: z.string(),
  targetDate: z.string(),
  successorEntityId: z.string().nullable(),
  projectId: z.string().nullable(),
  notes: z.string().nullable(),
  baselineImpact: z.array(deprecationImpactEntrySchema),
  currentImpact: z.array(deprecationImpactEntrySchema).nullable(),
  overdue: z.boolean(),
  initiatorUserId: z.string().nullable(),
  createdAt: z.string(),
  approveAssignmentIds: z.array(z.string()),
  acks: z.array(deprecationAckSchema)
});

const proposeDeprecationBodySchema = z.object({
  baseVersion: z.number().int().min(1),
  reason: z.string().min(1),
  targetDate: z.string(),
  successorEntityId: z.string().optional(),
  projectId: z.string().optional(),
  notes: z.string().optional()
});

const acknowledgeBodySchema = z.object({
  idempotencyKey: z.string(),
  comment: z.string().optional(),
  plannedRemediation: z.string().optional(),
  remediationProjectId: z.string().optional(),
  targetRemediationDate: z.string().optional(),
  riskAccepted: z.boolean().optional()
});

const postponeBodySchema = z.object({
  targetDate: z.string(),
  reason: z.string().min(1)
});

const finalizeBodySchema = z.object({
  reason: z.string().optional(),
  override: z.boolean().optional()
});

const cancelBodySchema = z.object({
  reason: z.string().min(1)
});

export const entityDeprecationContract = oc.tag('Entity deprecation').router({
  entityDeprecations: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/deprecation',
        inputStructure: 'detailed',
        summary: 'Get the current entity deprecation case',
        tags: ['Entity deprecation']
      })
      .input(z.object({ params: wsAndId }))
      .output(deprecationCaseSchema.nullable()),
    propose: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/deprecation/proposals',
        inputStructure: 'detailed',
        summary: 'Propose deprecating an entity',
        tags: ['Entity deprecation']
      })
      .input(z.object({ params: wsAndId, body: proposeDeprecationBodySchema }))
      .output(deprecationCaseSchema),
    acknowledge: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/deprecation/{caseId}/acknowledge',
        inputStructure: 'detailed',
        summary: "Acknowledge an owner team's deprecation impact",
        tags: ['Entity deprecation']
      })
      .input(
        z.object({
          params: wsAndId.extend({ caseId: z.string() }),
          body: acknowledgeBodySchema
        })
      )
      .output(deprecationCaseSchema),
    refreshScope: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/deprecation/{caseId}/refresh-scope',
        inputStructure: 'detailed',
        summary: 'Recompute current impact and open tasks for newly affected teams',
        tags: ['Entity deprecation']
      })
      .input(z.object({ params: wsAndId.extend({ caseId: z.string() }) }))
      .output(deprecationCaseSchema),
    postpone: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/deprecation/{caseId}/postpone',
        inputStructure: 'detailed',
        summary: 'Postpone a scheduled deprecation to a new target date',
        tags: ['Entity deprecation']
      })
      .input(
        z.object({
          params: wsAndId.extend({ caseId: z.string() }),
          body: postponeBodySchema
        })
      )
      .output(deprecationCaseSchema),
    finalize: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/deprecation/{caseId}/finalize',
        inputStructure: 'detailed',
        summary: 'Finalize a scheduled deprecation, setting the live lifecycle',
        tags: ['Entity deprecation']
      })
      .input(
        z.object({
          params: wsAndId.extend({ caseId: z.string() }),
          body: finalizeBodySchema
        })
      )
      .output(deprecationCaseSchema),
    cancel: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/deprecation/{caseId}/cancel',
        inputStructure: 'detailed',
        summary: 'Cancel a proposed or scheduled deprecation',
        tags: ['Entity deprecation']
      })
      .input(
        z.object({
          params: wsAndId.extend({ caseId: z.string() }),
          body: cancelBodySchema
        })
      )
      .output(deprecationCaseSchema)
  }
});

export type DeprecationImpactEntry = z.infer<typeof deprecationImpactEntrySchema>;
export type DeprecationAck = z.infer<typeof deprecationAckSchema>;
export type DeprecationCase = z.infer<typeof deprecationCaseSchema>;
export type ProposeDeprecationBody = z.infer<typeof proposeDeprecationBodySchema>;
export type AcknowledgeDeprecationBody = z.infer<typeof acknowledgeBodySchema>;
export type PostponeDeprecationBody = z.infer<typeof postponeBodySchema>;
export type FinalizeDeprecationBody = z.infer<typeof finalizeBodySchema>;
export type CancelDeprecationBody = z.infer<typeof cancelBodySchema>;

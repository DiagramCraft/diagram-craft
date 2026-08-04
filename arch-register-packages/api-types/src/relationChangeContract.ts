import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';

const relationChangeApprovalStatusSchema = z.enum(['open', 'approved', 'rejected', 'withdrawn']);
const relationChangeApprovalRevisionStatusSchema = z.enum([
  'submitted',
  'changes_requested',
  'stale',
  'approved',
  'rejected',
  'withdrawn'
]);

const relationChangeApprovalRevisionSchema = z.object({
  id: z.string(),
  approvalId: z.string(),
  relationId: z.string(),
  revisionNumber: z.number().int(),
  baseVersion: z.number().int(),
  baseState: z.record(z.string(), z.unknown()),
  proposedState: z.record(z.string(), z.unknown()),
  diff: z.record(z.string(), z.unknown()),
  policyVersion: z.string(),
  resolvedPolicy: z.record(z.string(), z.unknown()),
  message: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdByName: z.string().nullable(),
  status: relationChangeApprovalRevisionStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  caseId: z.string().nullable()
});

const relationChangeApprovalSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  relationId: z.string(),
  status: relationChangeApprovalStatusSchema,
  initiatorUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  revisions: z.array(relationChangeApprovalRevisionSchema)
});

const relationChangeApprovalRequestBodySchema = z.object({
  baseVersion: z.number().int().min(1),
  proposedState: z.record(z.string(), z.unknown()),
  message: z.string().optional(),
  dueAt: z.string().optional()
});

const withdrawRelationChangeApprovalBodySchema = z.object({
  reason: z.string().optional()
});

const relationApprovalBypassRequestBodySchema = relationChangeApprovalRequestBodySchema.extend({
  reason: z.string().min(1)
});

export const relationChangeContract = oc.tag('Relation change approval').router({
  relationChanges: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relations/{id}/change-approvals/current',
        inputStructure: 'detailed',
        summary: 'Get the current relation change approval',
        description:
          'Retrieves the open change-approval proposal for a relation instance, if any. Mirrors ' +
          'the entity change-approval workflow (single-record only; bulk proposals spanning ' +
          'multiple relations are not yet supported).',
        tags: ['Relation change approval']
      })
      .input(z.object({ params: wsAndId }))
      .output(relationChangeApprovalSchema.nullable()),
    submit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relations/{id}/change-approvals',
        inputStructure: 'detailed',
        summary: 'Submit a relation change approval request',
        description:
          'Proposes a change to a relation instance that requires approval before it takes ' +
          'effect, creating a governance case for eligible approvers.',
        tags: ['Relation change approval']
      })
      .input(z.object({ params: wsAndId, body: relationChangeApprovalRequestBodySchema }))
      .output(relationChangeApprovalSchema),
    resubmit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relations/{id}/change-approvals/{approvalId}/revisions',
        inputStructure: 'detailed',
        summary: 'Submit a new revision of a relation change approval request',
        description:
          'Submits a new revision for an existing proposal after changes were requested or the ' +
          'previous revision went stale.',
        tags: ['Relation change approval']
      })
      .input(
        z.object({
          params: wsAndId.extend({ approvalId: z.string().describe('Proposal identifier') }),
          body: relationChangeApprovalRequestBodySchema
        })
      )
      .output(relationChangeApprovalSchema),
    withdraw: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relations/{id}/change-approvals/{approvalId}/withdraw',
        inputStructure: 'detailed',
        summary: 'Withdraw a relation change approval request',
        description: 'Withdraws a not-yet-decided relation change proposal and cancels its governance case.',
        tags: ['Relation change approval']
      })
      .input(
        z.object({
          params: wsAndId.extend({ approvalId: z.string().describe('Proposal identifier') }),
          body: withdrawRelationChangeApprovalBodySchema
        })
      )
      .output(relationChangeApprovalSchema),
    bypass: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relations/{id}/approval-bypass',
        inputStructure: 'detailed',
        summary: 'Apply an audited relation approval bypass',
        description:
          'Directly writes a relation change without going through approval, for holders of the ' +
          'entity approval override capability. Mirrors the entity approval bypass: if the ' +
          'relation has an open proposal, it is marked approved and its governance case cancelled.',
        tags: ['Relation change approval']
      })
      .input(
        z.object({
          params: wsAndId,
          body: relationApprovalBypassRequestBodySchema
        })
      )
      .output(
        z.object({ relationId: z.string(), version: z.number().int(), bypassed: z.literal(true) })
      )
  }
});

export type RelationChangeApproval = z.infer<typeof relationChangeApprovalSchema>;
export type RelationChangeApprovalRevision = z.infer<typeof relationChangeApprovalRevisionSchema>;
export type RelationChangeApprovalRequestBody = z.infer<
  typeof relationChangeApprovalRequestBodySchema
>;
export type WithdrawRelationChangeApprovalBody = z.infer<
  typeof withdrawRelationChangeApprovalBodySchema
>;
export type RelationApprovalBypassRequestBody = z.infer<
  typeof relationApprovalBypassRequestBodySchema
>;

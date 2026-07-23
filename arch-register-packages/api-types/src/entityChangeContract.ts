import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId } from '@arch-register/api-types/common';

const entityChangeApprovalStatusSchema = z.enum(['open', 'approved', 'rejected', 'withdrawn']);
const entityChangeApprovalRevisionStatusSchema = z.enum([
  'submitted',
  'changes_requested',
  'stale',
  'approved',
  'rejected',
  'withdrawn'
]);

const entityChangeApprovalRevisionSchema = z.object({
  id: z.string(),
  approvalId: z.string(),
  entityId: z.string(),
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
  status: entityChangeApprovalRevisionStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  caseId: z.string().nullable()
});

const entityChangeApprovalSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  entityId: z.string(),
  status: entityChangeApprovalStatusSchema,
  initiatorUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  revisions: z.array(entityChangeApprovalRevisionSchema)
});

const changeApprovalRequestBodySchema = z.object({
  baseVersion: z.number().int().min(1),
  proposedState: z.record(z.string(), z.unknown()),
  message: z.string().optional()
});

const entityChangeBulkApprovalMemberSchema = z.object({
  entityId: z.string(),
  baseVersion: z.number().int().min(1),
  proposedState: z.record(z.string(), z.unknown())
});

const bulkChangeApprovalRequestBodySchema = z.object({
  members: z.array(entityChangeBulkApprovalMemberSchema).min(2),
  message: z.string().optional()
});

const entityChangeBulkApprovalRevisionMemberSchema = z.object({
  entityId: z.string(),
  baseVersion: z.number().int(),
  baseState: z.record(z.string(), z.unknown()),
  proposedState: z.record(z.string(), z.unknown()),
  diff: z.record(z.string(), z.unknown())
});

const entityChangeBulkApprovalRevisionSchema = z.object({
  id: z.string(),
  approvalId: z.string(),
  revisionNumber: z.number().int(),
  members: z.array(entityChangeBulkApprovalRevisionMemberSchema),
  policyVersion: z.string(),
  resolvedPolicy: z.record(z.string(), z.unknown()),
  message: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdByName: z.string().nullable(),
  status: entityChangeApprovalRevisionStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  caseId: z.string().nullable()
});

const entityChangeBulkApprovalSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  entityIds: z.array(z.string()),
  status: entityChangeApprovalStatusSchema,
  initiatorUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  revisions: z.array(entityChangeBulkApprovalRevisionSchema)
});

export const entityChangeContract = oc.tag('Entity change approval').router({
  entityChanges: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/change-approvals/current',
        inputStructure: 'detailed',
        summary: 'Get the current entity change approval',
        tags: ['Entity changes']
      })
      .input(z.object({ params: wsAndId }))
      .output(entityChangeApprovalSchema.nullable()),
    submit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/change-approvals',
        inputStructure: 'detailed',
        summary: 'Submit an entity change approval request',
        tags: ['Entity changes']
      })
      .input(z.object({ params: wsAndId, body: changeApprovalRequestBodySchema }))
      .output(entityChangeApprovalSchema),
    resubmit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/change-approvals/{approvalId}/revisions',
        inputStructure: 'detailed',
        summary: 'Submit a new revision of an entity change approval request',
        tags: ['Entity changes']
      })
      .input(
        z.object({
          params: wsAndId.extend({ approvalId: z.string() }),
          body: changeApprovalRequestBodySchema
        })
      )
      .output(entityChangeApprovalSchema),
    withdraw: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/change-approvals/{approvalId}/withdraw',
        inputStructure: 'detailed',
        summary: 'Withdraw an entity change approval request',
        tags: ['Entity changes']
      })
      .input(
        z.object({
          params: wsAndId.extend({ approvalId: z.string() }),
          body: z.object({ reason: z.string().optional() })
        })
      )
      .output(entityChangeApprovalSchema),
    bypass: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/approval-bypass',
        inputStructure: 'detailed',
        summary: 'Apply an audited entity approval bypass',
        tags: ['Entity changes']
      })
      .input(
        z.object({
          params: wsAndId,
          body: changeApprovalRequestBodySchema.extend({ reason: z.string().min(1) })
        })
      )
      .output(
        z.object({ entityId: z.string(), version: z.number().int(), bypassed: z.literal(true) })
      ),
    submitBulk: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entity-change-approvals/bulk',
        inputStructure: 'detailed',
        summary: 'Submit a bulk entity change approval request spanning multiple entities',
        tags: ['Entity changes']
      })
      .input(z.object({ params: ws, body: bulkChangeApprovalRequestBodySchema }))
      .output(entityChangeBulkApprovalSchema),
    getBulk: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entity-change-approvals/bulk/{approvalId}',
        inputStructure: 'detailed',
        summary: 'Get a bulk entity change approval request',
        tags: ['Entity changes']
      })
      .input(z.object({ params: ws.extend({ approvalId: z.string() }) }))
      .output(entityChangeBulkApprovalSchema.nullable())
  }
});

export type EntityChangeApproval = z.infer<typeof entityChangeApprovalSchema>;
export type EntityChangeApprovalRevision = z.infer<typeof entityChangeApprovalRevisionSchema>;
export type EntityChangeApprovalRequestBody = z.infer<typeof changeApprovalRequestBodySchema>;
export type EntityChangeBulkApproval = z.infer<typeof entityChangeBulkApprovalSchema>;
export type EntityChangeBulkApprovalRevision = z.infer<
  typeof entityChangeBulkApprovalRevisionSchema
>;
export type EntityChangeBulkApprovalRequestBody = z.infer<
  typeof bulkChangeApprovalRequestBodySchema
>;
export type EntityChangeBulkApprovalMember = z.infer<typeof entityChangeBulkApprovalMemberSchema>;

import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId } from '@arch-register/api-types/common';

const entityChangeStatusSchema = z.enum(['open', 'approved', 'rejected', 'withdrawn']);
const entityChangeRevisionStatusSchema = z.enum([
  'submitted',
  'changes_requested',
  'stale',
  'approved',
  'rejected',
  'withdrawn'
]);

const entityChangeRevisionSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
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
  status: entityChangeRevisionStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  caseId: z.string().nullable()
});

const entityChangeProposalSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  entityId: z.string(),
  status: entityChangeStatusSchema,
  initiatorUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  revisions: z.array(entityChangeRevisionSchema)
});

const proposalBodySchema = z.object({
  baseVersion: z.number().int().min(1),
  proposedState: z.record(z.string(), z.unknown()),
  message: z.string().optional()
});

const entityChangeBulkProposalMemberSchema = z.object({
  entityId: z.string(),
  baseVersion: z.number().int().min(1),
  proposedState: z.record(z.string(), z.unknown())
});

const bulkProposalBodySchema = z.object({
  members: z.array(entityChangeBulkProposalMemberSchema).min(2),
  message: z.string().optional()
});

const entityChangeBulkRevisionMemberSchema = z.object({
  entityId: z.string(),
  baseVersion: z.number().int(),
  baseState: z.record(z.string(), z.unknown()),
  proposedState: z.record(z.string(), z.unknown()),
  diff: z.record(z.string(), z.unknown())
});

const entityChangeBulkRevisionSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  revisionNumber: z.number().int(),
  members: z.array(entityChangeBulkRevisionMemberSchema),
  policyVersion: z.string(),
  resolvedPolicy: z.record(z.string(), z.unknown()),
  message: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdByName: z.string().nullable(),
  status: entityChangeRevisionStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  caseId: z.string().nullable()
});

const entityChangeBulkProposalSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  entityIds: z.array(z.string()),
  status: entityChangeStatusSchema,
  initiatorUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  revisions: z.array(entityChangeBulkRevisionSchema)
});

export const entityChangeContract = oc.tag('Entity change approval').router({
  entityChanges: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/proposals/current',
        inputStructure: 'detailed',
        summary: 'Get the current entity change proposal',
        tags: ['Entity changes']
      })
      .input(z.object({ params: wsAndId }))
      .output(entityChangeProposalSchema.nullable()),
    submit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/proposals',
        inputStructure: 'detailed',
        summary: 'Submit an entity change proposal',
        tags: ['Entity changes']
      })
      .input(z.object({ params: wsAndId, body: proposalBodySchema }))
      .output(entityChangeProposalSchema),
    resubmit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/proposals/{proposalId}/revisions',
        inputStructure: 'detailed',
        summary: 'Submit a new revision of an entity change proposal',
        tags: ['Entity changes']
      })
      .input(
        z.object({
          params: wsAndId.extend({ proposalId: z.string() }),
          body: proposalBodySchema
        })
      )
      .output(entityChangeProposalSchema),
    withdraw: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/proposals/{proposalId}/withdraw',
        inputStructure: 'detailed',
        summary: 'Withdraw an entity change proposal',
        tags: ['Entity changes']
      })
      .input(
        z.object({
          params: wsAndId.extend({ proposalId: z.string() }),
          body: z.object({ reason: z.string().optional() })
        })
      )
      .output(entityChangeProposalSchema),
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
          body: proposalBodySchema.extend({ reason: z.string().min(1) })
        })
      )
      .output(
        z.object({ entityId: z.string(), version: z.number().int(), bypassed: z.literal(true) })
      ),
    submitBulk: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entity-changes/bulk',
        inputStructure: 'detailed',
        summary: 'Submit a bulk entity change proposal spanning multiple entities',
        tags: ['Entity changes']
      })
      .input(z.object({ params: ws, body: bulkProposalBodySchema }))
      .output(entityChangeBulkProposalSchema),
    getBulk: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entity-changes/bulk/{proposalId}',
        inputStructure: 'detailed',
        summary: 'Get a bulk entity change proposal',
        tags: ['Entity changes']
      })
      .input(z.object({ params: ws.extend({ proposalId: z.string() }) }))
      .output(entityChangeBulkProposalSchema.nullable())
  }
});

export type EntityChangeProposal = z.infer<typeof entityChangeProposalSchema>;
export type EntityChangeRevision = z.infer<typeof entityChangeRevisionSchema>;
export type EntityChangeProposalBody = z.infer<typeof proposalBodySchema>;
export type EntityChangeBulkProposal = z.infer<typeof entityChangeBulkProposalSchema>;
export type EntityChangeBulkRevision = z.infer<typeof entityChangeBulkRevisionSchema>;
export type EntityChangeBulkProposalBody = z.infer<typeof bulkProposalBodySchema>;
export type EntityChangeBulkProposalMember = z.infer<
  typeof entityChangeBulkProposalMemberSchema
>;

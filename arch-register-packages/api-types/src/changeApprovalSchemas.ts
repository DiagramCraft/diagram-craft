import { z } from 'zod';

export const changeApprovalStatusSchema = z.enum(['open', 'approved', 'rejected', 'withdrawn']);

export const changeApprovalRevisionStatusSchema = z.enum([
  'submitted',
  'changes_requested',
  'stale',
  'approved',
  'rejected',
  'withdrawn'
]);

export const changeApprovalRequestBodySchema = z.object({
  baseVersion: z.number().int().min(1),
  proposedState: z.record(z.string(), z.unknown()),
  message: z.string().optional(),
  dueAt: z.string().optional(),
  initiationFields: z.record(z.string(), z.unknown()).optional()
});

export const withdrawChangeApprovalBodySchema = z.object({
  reason: z.string().optional()
});

export const createChangeApprovalSchemas = <SubjectIdKey extends 'entityId' | 'relationId'>(
  subjectIdKey: SubjectIdKey
) => {
  const subjectShape = { [subjectIdKey]: z.string() } as {
    [Key in SubjectIdKey]: z.ZodString;
  };

  const approvalRevisionSchema = z.object({
    id: z.string(),
    approvalId: z.string(),
    ...subjectShape,
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
    status: changeApprovalRevisionStatusSchema,
    createdAt: z.string(),
    resolvedAt: z.string().nullable(),
    caseId: z.string().nullable()
  });

  const approvalSchema = z.object({
    id: z.string(),
    workspace: z.string(),
    ...subjectShape,
    status: changeApprovalStatusSchema,
    initiatorUserId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    closedAt: z.string().nullable(),
    revisions: z.array(approvalRevisionSchema)
  });

  return {
    approvalStatusSchema: changeApprovalStatusSchema,
    approvalRevisionStatusSchema: changeApprovalRevisionStatusSchema,
    approvalRevisionSchema,
    approvalSchema,
    approvalRequestBodySchema: changeApprovalRequestBodySchema,
    withdrawBodySchema: withdrawChangeApprovalBodySchema,
    bypassBodySchema: changeApprovalRequestBodySchema.extend({ reason: z.string().min(1) })
  };
};

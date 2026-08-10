import { describe, expect, it } from 'vitest';
import { createChangeApprovalSchemas } from './changeApprovalSchemas';

const revision = {
  id: 'revision-1',
  approvalId: 'approval-1',
  revisionNumber: 1,
  baseVersion: 1,
  baseState: {},
  proposedState: {},
  diff: {},
  policyVersion: 'v1',
  resolvedPolicy: {},
  message: null,
  createdBy: null,
  createdByName: null,
  status: 'submitted' as const,
  createdAt: '2026-08-10T00:00:00.000Z',
  resolvedAt: null,
  caseId: null
};

describe('createChangeApprovalSchemas', () => {
  it('keeps subject identifiers distinct for entity and relation contracts', () => {
    const entity = createChangeApprovalSchemas('entityId');
    const relation = createChangeApprovalSchemas('relationId');

    expect(
      entity.approvalSchema.safeParse({
        id: 'approval-1',
        workspace: 'ws-1',
        entityId: 'entity-1',
        status: 'open',
        initiatorUserId: null,
        createdAt: revision.createdAt,
        updatedAt: revision.createdAt,
        closedAt: null,
        revisions: [{ ...revision, entityId: 'entity-1' }]
      }).success
    ).toBe(true);
    expect(
      relation.approvalSchema.safeParse({
        id: 'approval-1',
        workspace: 'ws-1',
        entityId: 'relation-1',
        status: 'open',
        initiatorUserId: null,
        createdAt: revision.createdAt,
        updatedAt: revision.createdAt,
        closedAt: null,
        revisions: [{ ...revision, entityId: 'relation-1' }]
      }).success
    ).toBe(false);
    expect(
      relation.approvalSchema.safeParse({
        id: 'approval-1',
        workspace: 'ws-1',
        relationId: 'relation-1',
        status: 'open',
        initiatorUserId: null,
        createdAt: revision.createdAt,
        updatedAt: revision.createdAt,
        closedAt: null,
        revisions: [{ ...revision, relationId: 'relation-1' }]
      }).success
    ).toBe(true);
  });

  it('shares request, withdraw, and bypass validation', () => {
    const schemas = createChangeApprovalSchemas('entityId');
    const request = {
      baseVersion: 1,
      proposedState: { data: { name: 'Updated' } },
      message: 'Please review'
    };

    expect(schemas.approvalRequestBodySchema.safeParse(request).success).toBe(true);
    expect(schemas.withdrawBodySchema.safeParse({ reason: 'No longer needed' }).success).toBe(true);
    expect(schemas.bypassBodySchema.safeParse({ ...request, reason: '' }).success).toBe(false);
    expect(schemas.bypassBodySchema.safeParse({ ...request, reason: 'Urgent fix' }).success).toBe(
      true
    );
  });
});

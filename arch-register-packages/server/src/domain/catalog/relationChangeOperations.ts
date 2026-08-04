import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { RelationDbResult } from './db/relationDatabase';
import type { EntityChangeApprovalDbResult } from './db/entityChangeDatabase';
import {
  buildApiEntityAuthCtx as buildApiAuthCtx,
  requireWorkspaceCapability
} from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import { listEligibleApproverIds, isSoleApprover } from './entityChangeOperations';
import {
  createGovernanceCaseInTransaction,
  recordGovernanceEvent,
  resolveAssignmentNotifications,
  resolveCaseNotifications
} from '../governance/governanceOperations';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  buildDiff,
  equalEntityValue,
  redactKnownDataDiff,
  type EntityFieldDiff
} from './entityDiff';
import {
  filterKnownRestrictedFieldGroups,
  requireNoRestrictedFieldWrites,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import { getRelationSchemaAt } from './schemaHistory';
import { relationToBaseState, requireRelationCaseMemberEditAccess } from './relationHelpers';
import type {
  RelationChangeApproval,
  RelationChangeApprovalRequestBody,
  RelationChangeApprovalRevision
} from '@arch-register/api-types/relationChangeContract';

export const RELATION_CHANGE_CASE_KIND = 'relation.change-case';

const permissionCheckerCapability = 'ent.propose' as const;

type ResolvedRelationApprovalPolicy = {
  required: boolean;
  selfApprovalAllowed: boolean;
  policyVersion: string;
};

/**
 * Mirrors policyFor (entityChangeOperations.ts) — kept as its own small function rather than
 * reused directly since `relation` has no `.owner`/`.version ?? 1` quirks an entity has, and
 * because policyVersion is namespaced per record kind to avoid colliding with an entity schema
 * of the same id (schema ids are workspace-unique per kind, not globally, so this is defensive).
 */
const policyFor = (
  schema: { id: string; version?: number; relation_approval_policy?: 'required' | 'disabled' },
  relation: RelationDbResult
): ResolvedRelationApprovalPolicy => {
  const override = relation.approval_policy_override ?? 'inherit';
  const required =
    relation.approval_policy_override === 'required'
      ? true
      : relation.approval_policy_override === 'disabled'
        ? false
        : (schema.relation_approval_policy ?? 'disabled') === 'required';
  return {
    required,
    selfApprovalAllowed: false,
    policyVersion: `relation-schema:${schema.id}:${schema.version ?? 1}:${override}`
  };
};

const assertCanPropose = async (
  db: DatabaseAdapter,
  workspace: string,
  relationId: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const relation = await db.relation.getRelation(workspace, relationId);
  httpAssert.present(relation, { status: 404, message: 'Relation not found' });
  await requireRelationCaseMemberEditAccess(db, workspace, authCtx, relation);
  requireWorkspaceCapability(authCtx, permissionCheckerCapability);
  return { authCtx, relation };
};

const buildProposedRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  relation: RelationDbResult,
  proposedState: Record<string, unknown>,
  authCtx?: WorkspaceAuthorizationContext | null
): Promise<{ state: Record<string, unknown>; data: Record<string, unknown> }> => {
  const schemaId = String(proposedState['schema_id'] ?? relation.schema_id);
  httpAssert.true(schemaId === relation.schema_id, {
    status: 400,
    message: 'Changing a relation schema is not supported by a relation change proposal'
  });
  const schema = await db.relation.getRelationSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 400, message: 'The proposed relation schema does not exist' });

  const data =
    proposedState['data'] != null && typeof proposedState['data'] === 'object'
      ? (proposedState['data'] as Record<string, unknown>)
      : {};
  if (authCtx) {
    const changedFieldIds = Object.keys(data).filter(
      fieldId => !equalEntityValue(relation.data[fieldId], data[fieldId])
    );
    requireNoRestrictedFieldWrites(
      authCtx,
      schema,
      changedFieldIds,
      'You do not have permission to propose changes to one or more restricted fields'
    );
  }
  const state = {
    ...relationToBaseState(relation),
    data,
    updated_at: relation.updated_at.toISOString()
  };
  return { state, data };
};

const schemaByIdForStates = async (
  db: DatabaseAdapter,
  workspace: string,
  states: Record<string, unknown>[],
  asOf: Date
): Promise<Map<string, FieldGroupSchemaShape>> => {
  const schemaIds = new Set(states.map(state => String(state['schema_id'])));
  const schemas = await Promise.all(
    [...schemaIds].map(schemaId => getRelationSchemaAt(db, workspace, schemaId, asOf))
  );
  return new Map(
    [...schemaIds]
      .map((schemaId, index) => [schemaId, schemas[index]] as const)
      .filter((entry): entry is [string, FieldGroupSchemaShape] => entry[1] != null)
  );
};

const findCaseForRevision = async (
  db: DatabaseAdapter,
  workspace: string,
  relationId: string,
  revisionId: string
): Promise<GovernanceCaseDbResult | null> => {
  const cases = await db.governance.listCases(workspace, {
    caseKind: RELATION_CHANGE_CASE_KIND,
    subjectId: relationId
  });
  return cases.find(candidate => candidate.subject_version === revisionId) ?? null;
};

const toApiApprovalRevision = (
  revision: import('./db/entityChangeDatabase').EntityChangeApprovalRevisionDbResult,
  caseId: string | null,
  createdByName: string | null,
  authCtx: WorkspaceAuthorizationContext | null,
  schemaById: Map<string, FieldGroupSchemaShape>
): RelationChangeApprovalRevision => {
  const baseSchema = schemaById.get(String(revision.base_state['schema_id'])) ?? null;
  const proposedSchema = schemaById.get(String(revision.proposed_state['schema_id'])) ?? null;
  return {
    id: revision.id,
    approvalId: revision.proposal_id,
    relationId: revision.entity_id,
    revisionNumber: revision.revision_number,
    baseVersion: revision.base_version,
    baseState: {
      ...revision.base_state,
      data: filterKnownRestrictedFieldGroups(
        authCtx,
        baseSchema,
        (revision.base_state['data'] ?? {}) as Record<string, unknown>
      )
    },
    proposedState: {
      ...revision.proposed_state,
      data: filterKnownRestrictedFieldGroups(
        authCtx,
        proposedSchema,
        (revision.proposed_state['data'] ?? {}) as Record<string, unknown>
      )
    },
    diff: redactKnownDataDiff(
      revision.diff as Record<string, EntityFieldDiff>,
      authCtx,
      baseSchema,
      proposedSchema
    ),
    policyVersion: revision.policy_version,
    resolvedPolicy: revision.resolved_policy,
    message: revision.message,
    createdBy: revision.created_by,
    createdByName,
    status: revision.status,
    createdAt: revision.created_at.toISOString(),
    resolvedAt: revision.resolved_at?.toISOString() ?? null,
    caseId
  };
};

const toApiApproval = async (
  db: DatabaseAdapter,
  proposal: EntityChangeApprovalDbResult,
  authCtx: WorkspaceAuthorizationContext | null
): Promise<RelationChangeApproval> => {
  const revisions = await db.entityChange.listApprovalRevisions(proposal.workspace, proposal.id);
  const apiRevisions = await Promise.all(
    revisions.map(async revision => {
      const schemaById = await schemaByIdForStates(
        db,
        proposal.workspace,
        [revision.base_state, revision.proposed_state],
        revision.created_at
      );
      const caseRow = await findCaseForRevision(
        db,
        proposal.workspace,
        proposal.entity_id,
        revision.id
      );
      const creator = revision.created_by ? await db.auth.getUser(revision.created_by) : null;
      return toApiApprovalRevision(
        revision,
        caseRow?.id ?? null,
        creator?.display_name ?? null,
        authCtx,
        schemaById
      );
    })
  );
  return {
    id: proposal.id,
    workspace: proposal.workspace,
    relationId: proposal.entity_id,
    status: proposal.status,
    initiatorUserId: proposal.initiator_user_id,
    createdAt: proposal.created_at.toISOString(),
    updatedAt: proposal.updated_at.toISOString(),
    closedAt: proposal.closed_at?.toISOString() ?? null,
    revisions: apiRevisions
  };
};

const submitProposal = async (
  db: DatabaseAdapter,
  workspaceName: string,
  relationId: string,
  event: AuthenticatedEvent,
  body: RelationChangeApprovalRequestBody,
  expectedProposalId?: string
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const { authCtx, relation } = await assertCanPropose(db, workspace, relationId, event);
  const canonicalRelationId = relation.id;
  const schema = await db.relation.getRelationSchema(workspace, relation.schema_id);
  httpAssert.present(schema, { status: 404, message: 'Relation schema not found' });
  const policy = policyFor(schema, relation);
  httpAssert.true(policy.required, {
    status: 409,
    statusText: 'Conflict',
    message: 'This relation does not require an approval proposal'
  });
  const { state: proposedState } = await buildProposedRelation(
    db,
    workspace,
    relation,
    body.proposedState,
    authCtx
  );
  const baseState = relationToBaseState(relation);
  const diff = buildDiff(baseState, proposedState);
  httpAssert.true(Object.keys(diff).length > 0, {
    status: 400,
    message: 'The proposal does not change the relation'
  });
  httpAssert.true(body.baseVersion === relation.version, {
    status: 409,
    statusText: 'Conflict',
    message: 'The relation changed while this proposal was being edited'
  });

  const userId = event.context.user.id;
  const now = new Date();
  const proposal = await db.core.transaction(async tx => {
    let root = await tx.entityChange.getOpenApproval(workspace, canonicalRelationId);
    if (expectedProposalId != null) {
      httpAssert.true(root?.id === expectedProposalId, {
        status: 404,
        message: 'Relation proposal not found'
      });
    }
    if (root == null) {
      root = await tx.entityChange.createApproval({
        id: randomUUID(),
        workspace,
        entity_id: canonicalRelationId,
        status: 'open',
        initiator_user_id: userId,
        created_at: now,
        updated_at: now,
        closed_at: null
      });
    } else {
      httpAssert.true(root.initiator_user_id === userId, {
        status: 403,
        message: 'Only the proposal initiator can submit a new revision'
      });
      const previous = await tx.entityChange.getLatestApprovalRevision(workspace, root.id);
      httpAssert.true(previous?.status === 'changes_requested' || previous?.status === 'stale', {
        status: 409,
        message: 'The current relation proposal is already awaiting a decision'
      });
    }

    const previous = await tx.entityChange.getLatestApprovalRevision(workspace, root.id);
    const assignments = [
      {
        action: 'approve' as const,
        target: { type: 'capability' as const, capability: 'ent.approve' as const }
      }
    ];
    const eligibleApproverIds = await listEligibleApproverIds(tx, workspace, null);
    const selfApprovalAllowed = isSoleApprover(eligibleApproverIds, userId);
    const resolvedPolicy = { ...policy, selfApprovalAllowed };
    const revision = await tx.entityChange.createApprovalRevision({
      id: randomUUID(),
      proposal_id: root.id,
      workspace,
      entity_id: canonicalRelationId,
      revision_number: (previous?.revision_number ?? 0) + 1,
      base_version: body.baseVersion,
      base_state: baseState,
      proposed_state: proposedState,
      diff,
      policy_version: policy.policyVersion,
      resolved_policy: resolvedPolicy,
      message: body.message ?? null,
      created_by: userId,
      status: 'submitted',
      created_at: now,
      resolved_at: null
    });

    await createGovernanceCaseInTransaction(
      tx,
      workspace,
      userId,
      {
        caseKind: RELATION_CHANGE_CASE_KIND,
        subjectType: 'relation',
        subjectId: canonicalRelationId,
        subjectVersion: revision.id,
        policyVersion: policy.policyVersion,
        selfApprovalAllowed,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        payload: { proposalId: root.id, revisionId: revision.id, relationId: canonicalRelationId },
        assignments
      },
      now
    );
    return root;
  });
  return await toApiApproval(db, proposal, authCtx);
};

export const submitRelationChangeApproval = (
  db: DatabaseAdapter,
  workspace: string,
  relationId: string,
  event: AuthenticatedEvent,
  body: RelationChangeApprovalRequestBody
) => submitProposal(db, workspace, relationId, event, body);

export const resubmitRelationChangeApproval = (
  db: DatabaseAdapter,
  workspace: string,
  relationId: string,
  proposalId: string,
  event: AuthenticatedEvent,
  body: RelationChangeApprovalRequestBody
) => submitProposal(db, workspace, relationId, event, body, proposalId);

export const getRelationChangeApproval = async (
  db: DatabaseAdapter,
  workspaceName: string,
  relationId: string,
  event: AuthenticatedEvent
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const relation = await db.relation.getRelation(workspace, relationId);
  httpAssert.present(relation, { status: 404, message: 'Relation not found' });
  await requireRelationCaseMemberEditAccess(db, workspace, authCtx, relation);
  const proposal = await db.entityChange.getOpenApproval(workspace, relation.id);
  return proposal ? await toApiApproval(db, proposal, authCtx) : null;
};

export const withdrawRelationChangeApproval = async (
  db: DatabaseAdapter,
  workspaceName: string,
  relationId: string,
  proposalId: string,
  event: AuthenticatedEvent,
  reason?: string
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const { authCtx, relation } = await assertCanPropose(db, workspace, relationId, event);
  const proposal = await db.entityChange.getOpenApproval(workspace, relation.id);
  httpAssert.true(proposal?.id === proposalId, {
    status: 404,
    message: 'Relation proposal not found'
  });
  httpAssert.present(proposal, { status: 404, message: 'Relation proposal not found' });
  httpAssert.true(proposal.initiator_user_id === event.context.user.id, {
    status: 403,
    message: 'Only the proposal initiator can withdraw this proposal'
  });
  const revision = await db.entityChange.getLatestApprovalRevision(workspace, proposal.id);
  httpAssert.present(revision, { status: 409, message: 'The relation proposal has no revision' });
  const caseRow = await findCaseForRevision(db, workspace, relation.id, revision.id);
  httpAssert.present(caseRow, { status: 409, message: 'The relation proposal case is missing' });
  const now = new Date();
  await db.core.transaction(async tx => {
    await tx.entityChange.updateApprovalRevisionStatus(workspace, revision.id, 'withdrawn', now);
    await tx.entityChange.updateApprovalStatus(workspace, proposal.id, 'withdrawn', now, now);
    const cancelled = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
    if (cancelled) {
      const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(caseRow.id, now);
      await resolveAssignmentNotifications(tx, supersededIds, now);
      await resolveCaseNotifications(tx, cancelled.id, now);
      await recordGovernanceEvent(tx, cancelled, {
        eventType: 'cancelled',
        actorUserId: event.context.user.id,
        previousStatus: 'open',
        resultingStatus: 'cancelled',
        reason: reason ?? null,
        metadata: { proposalId: proposal.id, revisionId: revision.id }
      });
    }
  });
  return await toApiApproval(
    db,
    (await db.entityChange.getApproval(workspace, proposal.id))!,
    authCtx
  );
};

import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { RelationDbResult } from './db/relationDatabase';
import type { EntityChangeApprovalDbResult } from './db/entityChangeDatabase';
import { httpAssert } from '../../utils/httpAssert';
import { isSoleApprover, listEligibleApproverIds } from './approvalWorkflowOperations';
import {
  createApprovalWorkflow,
  createApprovalGovernanceCaseConfig
} from './approvalWorkflowOperations';
import type { ApprovalSubjectAdapter } from './approvalWorkflowOperations';
import { findApprovalCaseForRevision } from './approvalLifecycleOperations';
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
import {
  relationToBaseState,
  requireRelationCaseMemberEditAccess,
  getRelationOwnerSchemas,
  flattenRelationAuditFields,
  relationAuditContext,
  assertRelationProposalEndpointsUnchanged
} from './relationHelpers';
import { canViewTypedRelation } from './relationAccessControl';
import { logAudit, computeChanges } from '../audit/db/auditLogging';
import type { GovernanceRegistry } from '../governance/governanceRegistry';
import type {
  RelationApprovalBypassRequestBody,
  RelationChangeApproval,
  RelationChangeApprovalRequestBody,
  RelationChangeApprovalRevision
} from '@arch-register/api-types/relationChangeContract';

export const RELATION_CHANGE_CASE_KIND = 'relation.change-case';

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
  httpAssert.present(schema, {
    status: 400,
    message: 'The proposed relation schema does not exist'
  });
  assertRelationProposalEndpointsUnchanged(relation, proposedState);

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
      const caseRow = await findApprovalCaseForRevision(
        db,
        proposal.workspace,
        proposal.entity_id,
        revision.id,
        RELATION_CHANGE_CASE_KIND
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

const relationApprovalAdapter: ApprovalSubjectAdapter<RelationDbResult, RelationChangeApproval> = {
  subjectName: 'Relation',
  subjectType: 'relation',
  caseKind: RELATION_CHANGE_CASE_KIND,
  getSubject: (db, workspace, relationId) => db.relation.getRelation(workspace, relationId),
  getSubjectId: relation => relation.id,
  getVersion: relation => relation.version,
  assertCanView: (db, workspace, authCtx, relation) =>
    requireRelationCaseMemberEditAccess(db, workspace, authCtx, relation),
  assertCanPropose: (db, workspace, authCtx, relation) =>
    requireRelationCaseMemberEditAccess(db, workspace, authCtx, relation),
  prepareProposal: async (db, workspace, relation, proposedState, authCtx) => {
    const { state } = await buildProposedRelation(db, workspace, relation, proposedState, authCtx);
    const baseState = relationToBaseState(relation);
    return { baseState, proposedState: state, diff: buildDiff(baseState, state) };
  },
  resolvePolicy: async (db, workspace, relation) => {
    const schema = await db.relation.getRelationSchema(workspace, relation.schema_id);
    httpAssert.present(schema, { status: 404, message: 'Relation schema not found' });
    const policy = policyFor(schema, relation);
    return { required: policy.required, policyVersion: policy.policyVersion };
  },
  resolveSubmission: async (db, workspace, relation, userId, policy) => {
    const assignments = [
      {
        action: 'approve' as const,
        target: { type: 'capability' as const, capability: 'ent.approve' as const }
      }
    ];
    const eligibleApproverIds = await listEligibleApproverIds(db, workspace, null);
    const selfApprovalAllowed = isSoleApprover(eligibleApproverIds, userId);
    return {
      required: policy.required,
      policyVersion: policy.policyVersion,
      resolvedPolicy: { ...policy, selfApprovalAllowed },
      assignments,
      selfApprovalAllowed,
      requiredApprovals: 1,
      casePayload: { relationId: relation.id }
    };
  },
  toApiApproval,
  applyBypass: async ({ tx, workspace, subject: relation, event, authCtx, body, now }) => {
    const { data } = await buildProposedRelation(
      tx,
      workspace,
      relation,
      body.proposedState,
      authCtx
    );
    const row = await tx.relation.updateRelation(workspace, relation.id, {
      data,
      version: relation.version + 1,
      updated_at: now
    });
    if (row == null) return null;

    const actorUserId = event.context.user.id;
    await logAudit(tx, {
      userId: actorUserId,
      workspace,
      operation: 'update',
      entityType: 'relation',
      entityId: relation.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: computeChanges(
        flattenRelationAuditFields(relation),
        flattenRelationAuditFields(row),
        { alwaysInclude: ['_inEntityId', '_outEntityId'] }
      ),
      metadata: {
        relation: relationAuditContext(row),
        approvalBypass: true,
        reason: body.reason
      }
    });
    await tx.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      record_id: relation.id,
      version_number: row.version,
      kind: 'autosave',
      commit_message: null,
      created_at: now,
      created_by: actorUserId,
      state: relationToBaseState(row),
      applied_case_revision_id: null
    });
    return { version: row.version };
  },
  governance: {
    subjectName: 'Relation',
    workflowConfig: {
      supportsApprovals: false,
      supportsReminders: true,
      supportsEscalation: false
    },
    reminders: { approachingDays: [2], overdueDays: [1, 5] },
    getSubjectIdFromCase: caseRow => String(caseRow.payload['relationId']),
    subjectVisible: async (db, authCtx, workspace, subjectId) => {
      const relation = await db.relation.getRelation(workspace, subjectId);
      if (!relation) return false;
      const { inSchema, outSchema } = await getRelationOwnerSchemas(db, workspace, relation);
      return canViewTypedRelation(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        relation.schema_id
      );
    },
    getSubject: (db, workspace, subjectId) => db.relation.getRelation(workspace, subjectId),
    toBaseState: relation => relationToBaseState(relation),
    conflictMessage: (_relation, keys) =>
      `The proposal is stale because the relation changed in: ${keys.join(', ')}`,
    applyDomainEffect: async ({ tx, caseRow, event, revision, subject: relation, nextState }) => {
      const relationId = relation.id;
      const nextData = (nextState['data'] as Record<string, unknown>) ?? {};
      const timestamp = new Date();
      const nextRelation = await tx.relation.updateRelation(caseRow.workspace, relationId, {
        data: nextData,
        version: relation.version + 1,
        updated_at: timestamp
      });
      httpAssert.present(nextRelation, {
        status: 409,
        statusText: 'Conflict',
        message: 'The relation changed after this proposal was submitted'
      });
      const actorUserId = event.actor_user_id ?? caseRow.initiator_user_id ?? 'system';
      await logAudit(tx, {
        userId: actorUserId,
        workspace: caseRow.workspace,
        operation: 'update',
        entityType: 'relation',
        entityId: relationId,
        entityName: `${nextRelation.in_entity_name} → ${nextRelation.out_entity_name}`,
        schemaId: nextRelation.schema_id,
        changes: computeChanges(
          flattenRelationAuditFields(relation),
          flattenRelationAuditFields(nextRelation),
          { alwaysInclude: ['_inEntityId', '_outEntityId'] }
        ),
        metadata: {
          relation: relationAuditContext(nextRelation),
          governanceCaseId: caseRow.id,
          proposalId: String(caseRow.payload['proposalId']),
          revisionId: revision.id
        }
      });
      await tx.catalog.createEntityVersion({
        id: randomUUID(),
        workspace: caseRow.workspace,
        record_id: relationId,
        version_number: nextRelation.version,
        kind: 'case_applied',
        commit_message: null,
        created_at: timestamp,
        created_by: actorUserId,
        state: relationToBaseState(nextRelation),
        applied_case_revision_id: revision.id
      });
      return { relationId, relationVersion: nextRelation.version };
    }
  }
};

const relationApprovalWorkflow = createApprovalWorkflow(relationApprovalAdapter);

export const submitRelationChangeApproval = (
  db: DatabaseAdapter,
  workspace: string,
  relationId: string,
  event: AuthenticatedEvent,
  body: RelationChangeApprovalRequestBody
) => relationApprovalWorkflow.submit(db, workspace, relationId, event, body);

export const resubmitRelationChangeApproval = (
  db: DatabaseAdapter,
  workspace: string,
  relationId: string,
  proposalId: string,
  event: AuthenticatedEvent,
  body: RelationChangeApprovalRequestBody
) => relationApprovalWorkflow.resubmit(db, workspace, relationId, proposalId, event, body);

export const getRelationChangeApproval = (
  db: DatabaseAdapter,
  workspaceName: string,
  relationId: string,
  event: AuthenticatedEvent
) => relationApprovalWorkflow.get(db, workspaceName, relationId, event);

export const withdrawRelationChangeApproval = (
  db: DatabaseAdapter,
  workspaceName: string,
  relationId: string,
  proposalId: string,
  event: AuthenticatedEvent,
  reason?: string
) => relationApprovalWorkflow.withdraw(db, workspaceName, relationId, proposalId, event, reason);

/**
 * Mirrors bypassEntityApproval (entityChangeOperations.ts): a direct, audited write that skips
 * approval entirely for holders of `ent.override`. If the relation has an open proposal, it is
 * marked approved and its governance case cancelled rather than left dangling against a base
 * version the bypass just moved past.
 */
export const bypassRelationApproval = (
  db: DatabaseAdapter,
  workspaceName: string,
  relationId: string,
  event: AuthenticatedEvent,
  body: RelationApprovalBypassRequestBody
) =>
  relationApprovalWorkflow.bypass(db, workspaceName, relationId, event, body).then(result => ({
    relationId: result.subjectId,
    version: result.version,
    bypassed: result.bypassed
  }));

export const createRelationGovernanceRegistry = (): GovernanceRegistry =>
  new Map([
    [
      RELATION_CHANGE_CASE_KIND,
      createApprovalGovernanceCaseConfig(relationApprovalAdapter.governance)
    ]
  ]);


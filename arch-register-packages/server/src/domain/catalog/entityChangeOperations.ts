import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter, EntityDbUpdate } from '../../db/database';
import type { Entity } from './db/catalogDatabase';
import {
  buildApiAuthCtx,
  requireEntityAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import {
  getLifecycleValues,
  getTeamIds,
  normalizeEntityRelationFields,
  parseEntityMutationPayload
} from './dataHelpers';
import { listAllCatalogEntities } from './entityLoader';
import { updateEntityWithAuditIfVersion } from './entityMutations';
import type {
  EntityChangeProposal,
  EntityChangeProposalBody,
  EntityChangeRevision
} from '@arch-register/api-types/entityChangeContract';
import type {
  EntityChangeProposalDbResult,
  EntityChangeRevisionDbResult
} from './db/entityChangeDatabase';
import {
  createGovernanceCaseInTransaction,
  recordGovernanceEvent
} from '../governance/governanceOperations';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import type { GovernanceRegistry } from '../governance/governanceRegistry';

export const ENTITY_CHANGE_CASE_KIND = 'entity.change';

const permissionChecker = new PermissionChecker();

type ResolvedEntityApprovalPolicy = {
  required: boolean;
  selfApprovalAllowed: boolean;
  policyVersion: string;
};

const stableStringify = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
};

const equalValue = (left: unknown, right: unknown) =>
  stableStringify(left) === stableStringify(right);

const entityState = (entity: Entity): Record<string, unknown> => ({
  id: entity.id,
  workspace: entity.workspace,
  public_id: entity.public_id,
  slug: entity.slug,
  namespace: entity.namespace,
  name: entity.name,
  description: entity.description,
  owner: entity.owner,
  lifecycle: entity.lifecycle,
  target_lifecycle: entity.target_lifecycle,
  target_lifecycle_date: entity.target_lifecycle_date,
  tags: entity.tags,
  links: entity.links,
  schema_id: entity.schema_id,
  data: entity.data,
  visibility_mode: entity.visibility_mode,
  created_at: entity.created_at.toISOString(),
  updated_at: entity.updated_at.toISOString()
});

const mutableStateKeys = [
  'slug',
  'namespace',
  'name',
  'description',
  'owner',
  'lifecycle',
  'target_lifecycle',
  'target_lifecycle_date',
  'tags',
  'links',
  'schema_id',
  'data',
  'visibility_mode'
] as const;

const buildDiff = (base: Record<string, unknown>, proposed: Record<string, unknown>) =>
  Object.fromEntries(
    mutableStateKeys
      .filter(key => !equalValue(base[key], proposed[key]))
      .map(key => [key, { before: base[key] ?? null, after: proposed[key] ?? null }])
  );

const policyFor = (
  schema: { id: string; version?: number; entity_approval_policy?: 'required' | 'disabled' },
  entity: Entity
): ResolvedEntityApprovalPolicy => {
  const override = entity.approval_policy_override ?? 'inherit';
  const required =
    entity.approval_policy_override === 'required'
      ? true
      : entity.approval_policy_override === 'disabled'
        ? false
        : (schema.entity_approval_policy ?? 'disabled') === 'required';
  return {
    required,
    selfApprovalAllowed: false,
    policyVersion: `${schema.id}:${schema.version ?? 1}:${override}`
  };
};

const authorizationEventForUser = (userId: string) =>
  ({ context: { user: { id: userId } } }) as unknown as AuthenticatedEvent;

const listEligibleApproverIds = async (
  db: DatabaseAdapter,
  workspace: string,
  ownerTeamId: string | null
) => {
  const [users, teamAssignments] = await Promise.all([
    db.auth.listUsers(),
    db.workspace.listTeamAssignments(workspace)
  ]);
  const activeUserIds = new Set(users.filter(user => user.is_active).map(user => user.id));
  const eligibleApproverIds = new Set(
    teamAssignments
      .filter(
        assignment =>
          ownerTeamId != null &&
          assignment.team_id === ownerTeamId &&
          assignment.role === 'team_admin' &&
          activeUserIds.has(assignment.user_id)
      )
      .map(assignment => assignment.user_id)
  );

  await Promise.all(
    users
      .filter(user => user.is_active)
      .map(async user => {
        const authCtx = await buildApiAuthCtx(db, workspace, authorizationEventForUser(user.id));
        if (permissionChecker.hasWorkspaceCapability(authCtx, 'ent.approve')) {
          eligibleApproverIds.add(user.id);
        }
      })
  );

  return eligibleApproverIds;
};

export const isSoleApprover = (eligibleApproverIds: ReadonlySet<string>, userId: string) =>
  eligibleApproverIds.size === 1 && eligibleApproverIds.has(userId);

export const entityRequiresApproval = (
  schema: { entity_approval_policy?: 'required' | 'disabled' },
  entity: Entity
) =>
  entity.approval_policy_override === 'required' ||
  (entity.approval_policy_override !== 'disabled' &&
    (schema.entity_approval_policy ?? 'disabled') === 'required');

const stateToMutationBody = (state: Record<string, unknown>, fallback: Entity) => ({
  _schemaId: state['schema_id'] ?? fallback.schema_id,
  _name: state['name'] ?? fallback.name,
  _slug: state['slug'] ?? fallback.slug,
  _namespace: state['namespace'] ?? fallback.namespace,
  _description: state['description'] ?? fallback.description,
  _owner: state['owner'] ?? fallback.owner,
  _lifecycle: state['lifecycle'] ?? fallback.lifecycle,
  _targetLifecycle: state['target_lifecycle'] ?? fallback.target_lifecycle,
  _targetLifecycleDate: state['target_lifecycle_date'] ?? fallback.target_lifecycle_date,
  _tags: state['tags'] ?? fallback.tags,
  _links: state['links'] ?? fallback.links,
  _visibilityMode: state['visibility_mode'] ?? fallback.visibility_mode,
  ...((state['data'] as Record<string, unknown> | undefined) ?? fallback.data)
});

const buildProposedEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entity: Entity,
  proposedState: Record<string, unknown>
): Promise<{ state: Record<string, unknown>; update: EntityDbUpdate }> => {
  const schema = await db.catalog.getSchema(
    workspace,
    String(proposedState['schema_id'] ?? entity.schema_id)
  );
  httpAssert.present(schema, { status: 400, message: 'The proposed entity schema does not exist' });
  httpAssert.true(schema.id === entity.schema_id, {
    status: 400,
    message: 'Changing an entity schema is not supported by an entity change proposal'
  });

  const mutationBody = Object.keys(proposedState).some(key => key.startsWith('_'))
    ? proposedState
    : stateToMutationBody(proposedState, entity);
  const payload = parseEntityMutationPayload(mutationBody);
  const lifecycleValues = await getLifecycleValues(db, workspace);
  const teamIds = await getTeamIds(db, workspace);
  httpAssert.true(
    payload.requestedLifecycle == null || lifecycleValues.has(payload.requestedLifecycle),
    {
      status: 400,
      message: 'The proposed lifecycle state does not exist'
    }
  );
  httpAssert.true(
    payload.requestedTargetLifecycle == null ||
      lifecycleValues.has(payload.requestedTargetLifecycle),
    { status: 400, message: 'The proposed target lifecycle state does not exist' }
  );
  httpAssert.true(payload.requestedOwner == null || teamIds.has(payload.requestedOwner), {
    status: 400,
    message: 'The proposed owner does not exist'
  });

  const entities = await listAllCatalogEntities(db, workspace);
  const data = normalizeEntityRelationFields({
    schema,
    fields: payload.fields,
    entities
  });
  const next: EntityDbUpdate = {
    slug: payload.slug,
    namespace: payload.namespace,
    name: payload.name,
    description: payload.description,
    owner: payload.requestedOwner,
    lifecycle: payload.requestedLifecycle,
    target_lifecycle: payload.requestedTargetLifecycle,
    target_lifecycle_date: payload.requestedTargetLifecycleDate,
    tags: payload.tags,
    links: payload.links,
    schema_id: payload.schemaId,
    data,
    visibility_mode: payload.visibilityMode,
    updated_at: new Date()
  };
  const state = {
    ...entityState(entity),
    ...next,
    updated_at: entity.updated_at.toISOString()
  };
  return { state, update: next };
};

const toApiRevision = (
  revision: EntityChangeRevisionDbResult,
  caseId: string | null,
  createdByName: string | null
): EntityChangeRevision => ({
  id: revision.id,
  proposalId: revision.proposal_id,
  entityId: revision.entity_id,
  revisionNumber: revision.revision_number,
  baseVersion: revision.base_version,
  baseState: revision.base_state,
  proposedState: revision.proposed_state,
  diff: revision.diff,
  policyVersion: revision.policy_version,
  resolvedPolicy: revision.resolved_policy,
  message: revision.message,
  createdBy: revision.created_by,
  createdByName,
  status: revision.status,
  createdAt: revision.created_at.toISOString(),
  resolvedAt: revision.resolved_at?.toISOString() ?? null,
  caseId
});

const findCaseForRevision = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  revisionId: string
): Promise<GovernanceCaseDbResult | null> => {
  const cases = await db.governance.listCases(workspace, {
    caseKind: ENTITY_CHANGE_CASE_KIND,
    subjectId: entityId
  });
  return cases.find(candidate => candidate.subject_version === revisionId) ?? null;
};

const toApiProposal = async (
  db: DatabaseAdapter,
  proposal: EntityChangeProposalDbResult
): Promise<EntityChangeProposal> => {
  const revisions = await db.entityChange.listRevisions(proposal.workspace, proposal.id);
  const apiRevisions = await Promise.all(
    revisions.map(async revision => {
      const caseRow = await findCaseForRevision(
        db,
        proposal.workspace,
        proposal.entity_id,
        revision.id
      );
      const creator = revision.created_by ? await db.auth.getUser(revision.created_by) : null;
      return toApiRevision(revision, caseRow?.id ?? null, creator?.display_name ?? null);
    })
  );
  return {
    id: proposal.id,
    workspace: proposal.workspace,
    entityId: proposal.entity_id,
    status: proposal.status,
    initiatorUserId: proposal.initiator_user_id,
    createdAt: proposal.created_at.toISOString(),
    updatedAt: proposal.updated_at.toISOString(),
    closedAt: proposal.closed_at?.toISOString() ?? null,
    revisions: apiRevisions
  };
};

const assertCanPropose = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: 'Entity not found' });
  requireEntityAction(authCtx, entity, 'view_entity');
  requireEntityAction(authCtx, entity, 'edit_entity');
  requireWorkspaceCapability(authCtx, 'ent.propose');
  return { authCtx, entity };
};

export const getEntityChangeProposal = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  event: AuthenticatedEvent
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: 'Entity not found' });
  requireEntityAction(authCtx, entity, 'view_entity');
  const proposal = await db.entityChange.getOpenProposal(workspace, entity.id);
  return proposal ? await toApiProposal(db, proposal) : null;
};

const submitProposal = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  event: AuthenticatedEvent,
  body: EntityChangeProposalBody,
  expectedProposalId?: string
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const { authCtx, entity } = await assertCanPropose(db, workspace, entityId, event);
  const canonicalEntityId = entity.id;
  const schema = await db.catalog.getSchema(workspace, entity.schema_id);
  httpAssert.present(schema, { status: 404, message: 'Entity schema not found' });
  const policy = policyFor(schema, entity);
  httpAssert.true(policy.required, {
    status: 409,
    statusText: 'Conflict',
    message: 'This entity does not require an approval proposal'
  });
  const { state: proposedState, update } = await buildProposedEntity(
    db,
    workspace,
    entity,
    body.proposedState
  );
  const baseState = entityState(entity);
  const diff = buildDiff(baseState, proposedState);
  httpAssert.true(Object.keys(diff).length > 0, {
    status: 400,
    message: 'The proposal does not change the entity'
  });
  httpAssert.true(body.baseVersion === (entity.version ?? 1), {
    status: 409,
    statusText: 'Conflict',
    message: 'The entity changed while this proposal was being edited'
  });
  if (update.owner !== entity.owner || update.visibility_mode !== entity.visibility_mode) {
    requireEntityAction(authCtx, entity, 'admin_entity');
  }

  const userId = event.context.user.id;
  const now = new Date();
  const proposal = await db.core.transaction(async tx => {
    let root = await tx.entityChange.getOpenProposal(workspace, canonicalEntityId);
    if (expectedProposalId != null) {
      httpAssert.true(root?.id === expectedProposalId, {
        status: 404,
        message: 'Entity proposal not found'
      });
    }
    if (root == null) {
      root = await tx.entityChange.createProposal({
        id: randomUUID(),
        workspace,
        entity_id: canonicalEntityId,
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
      const previous = await tx.entityChange.getLatestRevision(workspace, root.id);
      httpAssert.true(previous?.status === 'changes_requested' || previous?.status === 'stale', {
        status: 409,
        message: 'The current entity proposal is already awaiting a decision'
      });
    }

    const previous = await tx.entityChange.getLatestRevision(workspace, root.id);
    const ownerTeamIds = await getTeamIds(tx, workspace);
    const assignments = ownerTeamIds.has(entity.owner ?? '')
      ? [
          {
            action: 'approve' as const,
            target: {
              type: 'team_role' as const,
              teamId: entity.owner!,
              teamRole: 'team_admin' as const
            }
          },
          {
            action: 'approve' as const,
            target: { type: 'capability' as const, capability: 'ent.approve' as const }
          }
        ]
      : [
          {
            action: 'approve' as const,
            target: { type: 'capability' as const, capability: 'ent.approve' as const }
          }
        ];
    const eligibleApproverIds = await listEligibleApproverIds(
      tx,
      workspace,
      ownerTeamIds.has(entity.owner ?? '') ? entity.owner : null
    );
    const selfApprovalAllowed = isSoleApprover(eligibleApproverIds, userId);
    const resolvedPolicy = { ...policy, selfApprovalAllowed };
    const revision = await tx.entityChange.createRevision({
      id: randomUUID(),
      proposal_id: root.id,
      workspace,
      entity_id: canonicalEntityId,
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
        caseKind: ENTITY_CHANGE_CASE_KIND,
        subjectType: 'entity',
        subjectId: canonicalEntityId,
        subjectVersion: revision.id,
        policyVersion: policy.policyVersion,
        selfApprovalAllowed,
        payload: { proposalId: root.id, revisionId: revision.id, entityId: canonicalEntityId },
        assignments
      },
      now
    );
    return root;
  });
  return await toApiProposal(db, proposal);
};

export const submitEntityChangeProposal = (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent,
  body: EntityChangeProposalBody
) => submitProposal(db, workspace, entityId, event, body);

export const resubmitEntityChangeProposal = (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  proposalId: string,
  event: AuthenticatedEvent,
  body: EntityChangeProposalBody
) => submitProposal(db, workspace, entityId, event, body, proposalId);

export const withdrawEntityChangeProposal = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  proposalId: string,
  event: AuthenticatedEvent,
  reason?: string
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const { entity } = await assertCanPropose(db, workspace, entityId, event);
  const proposal = await db.entityChange.getOpenProposal(workspace, entity.id);
  httpAssert.true(proposal?.id === proposalId, {
    status: 404,
    message: 'Entity proposal not found'
  });
  httpAssert.present(proposal, { status: 404, message: 'Entity proposal not found' });
  httpAssert.true(proposal.initiator_user_id === event.context.user.id, {
    status: 403,
    message: 'Only the proposal initiator can withdraw this proposal'
  });
  const revision = await db.entityChange.getLatestRevision(workspace, proposal.id);
  httpAssert.present(revision, { status: 409, message: 'The entity proposal has no revision' });
  const caseRow = await findCaseForRevision(db, workspace, entity.id, revision.id);
  httpAssert.present(caseRow, { status: 409, message: 'The entity proposal case is missing' });
  const now = new Date();
  await db.core.transaction(async tx => {
    await tx.entityChange.updateRevisionStatus(workspace, revision.id, 'withdrawn', now);
    await tx.entityChange.updateProposalStatus(workspace, proposal.id, 'withdrawn', now, now);
    const cancelled = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
    if (cancelled) {
      await tx.governance.supersedeAllOpenAssignmentsForCase(caseRow.id, now);
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
  return await toApiProposal(db, (await db.entityChange.getProposal(workspace, proposal.id))!);
};

export const bypassEntityApproval = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  event: AuthenticatedEvent,
  body: EntityChangeProposalBody & { reason: string }
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const { authCtx, entity } = await assertCanPropose(db, workspace, entityId, event);
  const canonicalEntityId = entity.id;
  requireWorkspaceCapability(authCtx, 'ent.override');
  const updated = await db.core.transaction(async tx => {
    const now = new Date();
    const { update } = await buildProposedEntity(tx, workspace, entity, body.proposedState);
    const row = await updateEntityWithAuditIfVersion(tx, {
      workspace,
      entityId: canonicalEntityId,
      previous: entity,
      next: update,
      expectedVersion: body.baseVersion,
      actor: { id: event.context.user.id, displayName: event.context.user.display_name },
      auditMetadata: { approvalBypass: true, reason: body.reason }
    });
    if (row == null) return null;

    const proposal = await tx.entityChange.getOpenProposal(workspace, canonicalEntityId);
    if (proposal) {
      const revision = await tx.entityChange.getLatestRevision(workspace, proposal.id);
      if (revision) {
        await tx.entityChange.updateRevisionStatus(workspace, revision.id, 'approved', now);
        await tx.entityChange.updateProposalStatus(workspace, proposal.id, 'approved', now, now);
        const caseRow = await findCaseForRevision(tx, workspace, canonicalEntityId, revision.id);
        if (caseRow) {
          const cancelled = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
          if (cancelled) {
            await tx.governance.supersedeAllOpenAssignmentsForCase(caseRow.id, now);
            await recordGovernanceEvent(tx, cancelled, {
              eventType: 'admin_override',
              actorUserId: event.context.user.id,
              previousStatus: 'open',
              resultingStatus: 'cancelled',
              reason: body.reason,
              metadata: { proposalId: proposal.id, revisionId: revision.id }
            });
          }
        }
      }
    }
    return row;
  });
  httpAssert.present(updated, {
    status: 409,
    statusText: 'Conflict',
    message: 'The entity changed while the bypass was being applied'
  });
  return { entityId: canonicalEntityId, version: updated.version ?? 1, bypassed: true as const };
};

export const createEntityGovernanceRegistry = (): GovernanceRegistry =>
  new Map([
    [
      ENTITY_CHANGE_CASE_KIND,
      {
        subjectVisible: async (
          db,
          _authCtx: AuthorizationContext,
          workspace: string,
          subjectId: string
        ) => {
          const entity = await db.catalog.getEntity(workspace, subjectId);
          return (
            entity != null && permissionChecker.hasEntityPermission(_authCtx, entity, 'view_entity')
          );
        },
        beforeDecision: async (tx, { case: caseRow, decision }) => {
          if (decision !== 'approve') return 'proceed';
          const revision = await tx.entityChange.getRevision(
            caseRow.workspace,
            String(caseRow.payload['revisionId'])
          );
          const entity = await tx.catalog.getEntity(
            caseRow.workspace,
            String(caseRow.payload['entityId'])
          );
          if (!revision || !entity) return 'proceed';
          const currentState = entityState(entity);
          const conflicting = Object.keys(revision.diff).some(
            key =>
              !equalValue(revision.base_state[key], currentState[key]) &&
              !equalValue(currentState[key], revision.proposed_state[key])
          );
          if (!conflicting) return 'proceed';
          await tx.entityChange.updateRevisionStatus(
            caseRow.workspace,
            revision.id,
            'stale',
            new Date()
          );
          return 'stale';
        },
        handleDecision: async (tx, { case: caseRow, decision }) => {
          const payload = caseRow.payload;
          const revisionId = String(payload['revisionId']);
          const proposalId = String(payload['proposalId']);
          if (decision === 'request_changes') {
            await tx.entityChange.updateRevisionStatus(
              caseRow.workspace,
              revisionId,
              'changes_requested'
            );
          } else if (decision === 'reject') {
            await tx.entityChange.updateRevisionStatus(
              caseRow.workspace,
              revisionId,
              'rejected',
              new Date()
            );
            await tx.entityChange.updateProposalStatus(
              caseRow.workspace,
              proposalId,
              'rejected',
              new Date(),
              new Date()
            );
          }
        },
        applyDomainEffect: async (tx, { case: caseRow, event }) => {
          const payload = caseRow.payload;
          const revisionId = String(payload['revisionId']);
          const proposalId = String(payload['proposalId']);
          const entityId = String(payload['entityId']);
          const revision = await tx.entityChange.getRevision(caseRow.workspace, revisionId);
          httpAssert.present(revision, {
            status: 409,
            message: 'The proposal revision no longer exists'
          });
          const entity = await tx.catalog.getEntity(caseRow.workspace, entityId);
          httpAssert.present(entity, {
            status: 409,
            message: 'The governed entity no longer exists'
          });
          const currentState = entityState(entity);
          const touchedKeys = Object.keys(revision.diff);
          const conflictingKeys = touchedKeys.filter(
            key =>
              !equalValue(revision.base_state[key], currentState[key]) &&
              !equalValue(currentState[key], revision.proposed_state[key])
          );
          httpAssert.true(conflictingKeys.length === 0, {
            status: 409,
            statusText: 'Conflict',
            message: `The proposal is stale because the entity changed in: ${conflictingKeys.join(', ')}`
          });
          const next = { ...revision.proposed_state };
          for (const key of mutableStateKeys) {
            if (!touchedKeys.includes(key)) next[key] = currentState[key];
          }
          const actor = event.actor_user_id ? await tx.auth.getUser(event.actor_user_id) : null;
          const updated = await updateEntityWithAuditIfVersion(tx, {
            workspace: caseRow.workspace,
            entityId,
            previous: entity,
            next: {
              slug: String(next['slug']),
              namespace: String(next['namespace']),
              name: String(next['name']),
              description: String(next['description'] ?? ''),
              owner: (next['owner'] as string | null) ?? null,
              lifecycle: (next['lifecycle'] as string | null) ?? null,
              target_lifecycle: (next['target_lifecycle'] as string | null) ?? null,
              target_lifecycle_date: (next['target_lifecycle_date'] as string | null) ?? null,
              tags: Array.isArray(next['tags'])
                ? next['tags'].filter((value): value is string => typeof value === 'string')
                : [],
              links: Array.isArray(next['links']) ? next['links'] : [],
              schema_id: String(next['schema_id']),
              data: (next['data'] as Record<string, unknown>) ?? {},
              visibility_mode: (next['visibility_mode'] as 'public' | 'restricted' | null) ?? null,
              updated_at: new Date()
            },
            expectedVersion: entity.version ?? 1,
            actor: {
              id: event.actor_user_id ?? caseRow.initiator_user_id ?? 'system',
              displayName: actor?.display_name ?? null
            },
            auditMetadata: { governanceCaseId: caseRow.id, proposalId, revisionId }
          });
          httpAssert.present(updated, {
            status: 409,
            statusText: 'Conflict',
            message: 'The entity changed after this proposal was submitted'
          });
          await tx.entityChange.updateRevisionStatus(
            caseRow.workspace,
            revisionId,
            'approved',
            new Date()
          );
          await tx.entityChange.updateProposalStatus(
            caseRow.workspace,
            proposalId,
            'approved',
            new Date(),
            new Date()
          );
          await recordGovernanceEvent(tx, caseRow, {
            eventType: 'domain_effect_applied',
            actorUserId: event.actor_user_id,
            previousStatus: caseRow.status,
            resultingStatus: caseRow.status,
            reason: null,
            metadata: { entityId, proposalId, revisionId, entityVersion: updated.version ?? 1 }
          });
        }
      }
    ]
  ]);

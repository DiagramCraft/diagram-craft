import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter, EntityDbUpdate } from '../../db/database';
import type { Entity } from './db/catalogDatabase';
import {
  buildApiEntityAuthCtx as buildApiAuthCtx,
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
import { computeEntityCompleteness } from '../../utils/completeness';
import type {
  EntityChangeApproval,
  EntityChangeApprovalRequestBody,
  EntityChangeApprovalRevision,
  EntityChangeBulkApproval,
  EntityChangeBulkApprovalRequestBody,
  EntityChangeBulkApprovalRevision
} from '@arch-register/api-types/entityChangeContract';
import type {
  EntityChangeApprovalDbResult,
  EntityChangeApprovalRevisionDbResult,
  EntityChangeApprovalRevisionMemberDbResult
} from './db/entityChangeDatabase';
import {
  createGovernanceCaseInTransaction,
  recordGovernanceEvent,
  resolveScopeAwareEscalationTarget
} from '../governance/governanceOperations';
import {
  finalizeApprovalBypass,
  findApprovalCaseForRevision,
  withdrawApproval
} from './approvalLifecycleOperations';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import type {
  AuthorizationContext,
  WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import type { GovernanceRegistry } from '../governance/governanceRegistry';
import {
  buildDiff,
  equalEntityValue,
  mutableStateKeys,
  redactKnownDataDiff,
  type EntityFieldDiff
} from './entityDiff';
import {
  filterKnownRestrictedFieldGroups,
  requireNoRestrictedFieldWrites,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import { getEntitySchemaAt } from './schemaHistory';

export const ENTITY_CHANGE_CASE_KIND = 'entity.change-case';
export const ENTITY_CHANGE_CASE_BULK_KIND = 'entity.change-case.bulk';

const permissionChecker = new PermissionChecker();

type ResolvedEntityApprovalPolicy = {
  required: boolean;
  selfApprovalAllowed: boolean;
  policyVersion: string;
};

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
  project_id: entity.project_id,
  created_at: entity.created_at.toISOString(),
  updated_at: entity.updated_at.toISOString()
});

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

export const listEligibleApproverIds = async (
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
  _projectId: state['project_id'] ?? fallback.project_id,
  ...((state['data'] as Record<string, unknown> | undefined) ?? fallback.data)
});

const buildProposedEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entity: Entity,
  proposedState: Record<string, unknown>,
  authCtx?: WorkspaceAuthorizationContext | null
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
  if (authCtx) {
    const changedFieldIds = Object.keys(data).filter(
      fieldId => !equalEntityValue(entity.data[fieldId], data[fieldId])
    );
    requireNoRestrictedFieldWrites(
      authCtx,
      schema,
      changedFieldIds,
      'You do not have permission to propose changes to one or more restricted fields'
    );
  }
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
    project_id: payload.projectId,
    updated_at: new Date(),
    completeness: computeEntityCompleteness(
      {
        description: payload.description,
        owner: payload.requestedOwner,
        lifecycle: payload.requestedLifecycle,
        data
      },
      schema
    )
  };
  const state = {
    ...entityState(entity),
    ...next,
    updated_at: entity.updated_at.toISOString()
  };
  return { state, update: next };
};

export const toApiApprovalRevision = (
  revision: EntityChangeApprovalRevisionDbResult,
  caseId: string | null,
  createdByName: string | null,
  authCtx: WorkspaceAuthorizationContext | null,
  schemaById: Map<string, FieldGroupSchemaShape>
): EntityChangeApprovalRevision => {
  const baseSchema = schemaById.get(String(revision.base_state['schema_id'])) ?? null;
  const proposedSchema = schemaById.get(String(revision.proposed_state['schema_id'])) ?? null;
  return {
    id: revision.id,
    approvalId: revision.proposal_id,
    entityId: revision.entity_id,
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

const schemaByIdForStates = async (
  db: DatabaseAdapter,
  workspace: string,
  states: Record<string, unknown>[],
  asOf: Date
): Promise<Map<string, FieldGroupSchemaShape>> => {
  const schemaIds = new Set(states.map(state => String(state['schema_id'])));
  const schemas = await Promise.all(
    [...schemaIds].map(schemaId => getEntitySchemaAt(db, workspace, schemaId, asOf))
  );
  return new Map(
    [...schemaIds]
      .map((schemaId, index) => [schemaId, schemas[index]] as const)
      .filter((entry): entry is [string, FieldGroupSchemaShape] => entry[1] != null)
  );
};

const toApiApproval = async (
  db: DatabaseAdapter,
  proposal: EntityChangeApprovalDbResult,
  authCtx: WorkspaceAuthorizationContext | null
): Promise<EntityChangeApproval> => {
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
        ENTITY_CHANGE_CASE_KIND
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
    entityId: proposal.entity_id,
    status: proposal.status,
    initiatorUserId: proposal.initiator_user_id,
    createdAt: proposal.created_at.toISOString(),
    updatedAt: proposal.updated_at.toISOString(),
    closedAt: proposal.closed_at?.toISOString() ?? null,
    revisions: apiRevisions
  };
};

export const toApiBulkApprovalRevision = (
  members: EntityChangeApprovalRevisionMemberDbResult[],
  caseId: string | null,
  createdByName: string | null,
  authCtx: WorkspaceAuthorizationContext | null,
  schemaById: Map<string, FieldGroupSchemaShape>
): EntityChangeBulkApprovalRevision => {
  const first = members[0]!;
  return {
    id: first.id,
    approvalId: first.proposal_id,
    revisionNumber: first.revision_number,
    members: members.map(member => {
      const baseSchema = schemaById.get(String(member.base_state['schema_id'])) ?? null;
      const proposedSchema = schemaById.get(String(member.proposed_state['schema_id'])) ?? null;
      return {
        entityId: member.entity_id,
        baseVersion: member.base_version,
        baseState: {
          ...member.base_state,
          data: filterKnownRestrictedFieldGroups(
            authCtx,
            baseSchema,
            (member.base_state['data'] ?? {}) as Record<string, unknown>
          )
        },
        proposedState: {
          ...member.proposed_state,
          data: filterKnownRestrictedFieldGroups(
            authCtx,
            proposedSchema,
            (member.proposed_state['data'] ?? {}) as Record<string, unknown>
          )
        },
        diff: redactKnownDataDiff(
          member.diff as Record<string, EntityFieldDiff>,
          authCtx,
          baseSchema,
          proposedSchema
        )
      };
    }),
    policyVersion: first.policy_version,
    resolvedPolicy: first.resolved_policy,
    message: first.message,
    createdBy: first.created_by,
    createdByName,
    status: first.status,
    createdAt: first.created_at.toISOString(),
    resolvedAt: first.resolved_at?.toISOString() ?? null,
    caseId
  };
};

const findCaseForBulkRevision = async (
  db: DatabaseAdapter,
  workspace: string,
  caseId: string,
  revisionId: string
): Promise<GovernanceCaseDbResult | null> => {
  const cases = await db.governance.listCases(workspace, {
    caseKind: ENTITY_CHANGE_CASE_BULK_KIND,
    subjectId: caseId
  });
  return cases.find(candidate => candidate.subject_version === revisionId) ?? null;
};

const toApiBulkApproval = async (
  db: DatabaseAdapter,
  proposal: EntityChangeApprovalDbResult,
  authCtx: WorkspaceAuthorizationContext | null
): Promise<EntityChangeBulkApproval> => {
  const revisions = await db.entityChange.listApprovalRevisions(proposal.workspace, proposal.id);
  const revisionNumbers = [...new Set(revisions.map(revision => revision.revision_number))].sort(
    (a, b) => b - a
  );
  const membersByRevisionNumber = new Map(
    await Promise.all(
      revisionNumbers.map(async revisionNumber => {
        const revision = revisions.find(candidate => candidate.revision_number === revisionNumber)!;
        const members = await db.entityChange.getApprovalRevisionMembers(
          proposal.workspace,
          revision.id
        );
        return [revisionNumber, members] as const;
      })
    )
  );
  const apiRevisions = await Promise.all(
    revisionNumbers.map(async revisionNumber => {
      const revision = revisions.find(candidate => candidate.revision_number === revisionNumber)!;
      const members = membersByRevisionNumber.get(revisionNumber)!;
      const schemaById = await schemaByIdForStates(
        db,
        proposal.workspace,
        members.flatMap(member => [member.base_state, member.proposed_state]),
        revision.created_at
      );
      const caseRow = await findCaseForBulkRevision(
        db,
        proposal.workspace,
        proposal.id,
        revision.id
      );
      const creator = revision.created_by ? await db.auth.getUser(revision.created_by) : null;
      return toApiBulkApprovalRevision(
        members,
        caseRow?.id ?? null,
        creator?.display_name ?? null,
        authCtx,
        schemaById
      );
    })
  );
  const entityIds = [
    ...new Set(apiRevisions.flatMap(revision => revision.members.map(member => member.entityId)))
  ];
  return {
    id: proposal.id,
    workspace: proposal.workspace,
    entityIds,
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

export const getEntityChangeApproval = async (
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
  const proposal = await db.entityChange.getOpenApproval(workspace, entity.id);
  return proposal ? await toApiApproval(db, proposal, authCtx) : null;
};

export const getBulkEntityChangeApproval = async (
  db: DatabaseAdapter,
  workspaceName: string,
  proposalId: string,
  event: AuthenticatedEvent
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const proposal = await db.entityChange.getApproval(workspace, proposalId);
  if (!proposal) return null;
  const apiProposal = await toApiBulkApproval(db, proposal, authCtx);
  for (const entityId of apiProposal.entityIds) {
    const entity = await db.catalog.getEntity(workspace, entityId);
    if (entity) requireEntityAction(authCtx, entity, 'view_entity');
  }
  return apiProposal;
};

export const submitBulkEntityChangeApproval = async (
  db: DatabaseAdapter,
  workspaceName: string,
  event: AuthenticatedEvent,
  body: EntityChangeBulkApprovalRequestBody
): Promise<EntityChangeBulkApproval> => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  httpAssert.true(body.members.length >= 2, {
    status: 400,
    message: 'A bulk entity change proposal requires at least two entities'
  });

  const userId = event.context.user.id;
  const now = new Date();
  const authCtx = await buildApiAuthCtx(db, workspace, event);

  type PreparedMember = {
    entity: Entity;
    baseState: Record<string, unknown>;
    proposedState: Record<string, unknown>;
    diff: Record<string, unknown>;
    policy: ResolvedEntityApprovalPolicy;
  };

  const prepared: PreparedMember[] = [];
  for (const member of body.members) {
    const { authCtx, entity } = await assertCanPropose(db, workspace, member.entityId, event);
    requireWorkspaceCapability(authCtx, 'ent.propose');
    const schema = await db.catalog.getSchema(workspace, entity.schema_id);
    httpAssert.present(schema, { status: 404, message: 'Entity schema not found' });
    const policy = policyFor(schema, entity);
    httpAssert.true(policy.required, {
      status: 409,
      statusText: 'Conflict',
      message: `Entity ${entity.name} does not require an approval proposal`
    });
    const { state: proposedState, update } = await buildProposedEntity(
      db,
      workspace,
      entity,
      member.proposedState,
      authCtx
    );
    const baseState = entityState(entity);
    const diff = buildDiff(baseState, proposedState);
    if (Object.keys(diff).length === 0) continue;
    httpAssert.true(member.baseVersion === (entity.version ?? 1), {
      status: 409,
      statusText: 'Conflict',
      message: `Entity ${entity.name} changed while this proposal was being prepared`
    });
    if (update.owner !== entity.owner || update.project_id !== entity.project_id) {
      requireEntityAction(authCtx, entity, 'admin_entity');
    }
    prepared.push({ entity, baseState, proposedState, diff, policy });
  }

  httpAssert.true(prepared.length >= 2, {
    status: 400,
    message: 'A bulk entity change proposal requires at least two entities with actual changes'
  });

  const ownerTeamIds = await getTeamIds(db, workspace);
  const distinctOwnerTeams = [
    ...new Set(
      prepared
        .map(member => member.entity.owner)
        .filter((owner): owner is string => owner != null && ownerTeamIds.has(owner))
    )
  ];
  const assignments = [
    ...distinctOwnerTeams.map(teamId => ({
      action: 'approve' as const,
      target: { type: 'team_role' as const, teamId, teamRole: 'team_admin' as const }
    })),
    {
      action: 'approve' as const,
      target: { type: 'capability' as const, capability: 'ent.approve' as const }
    }
  ];

  const eligibleApproverIdSets = await Promise.all([
    listEligibleApproverIds(db, workspace, null),
    ...distinctOwnerTeams.map(teamId => listEligibleApproverIds(db, workspace, teamId))
  ]);
  const eligibleApproverIds = new Set<string>();
  for (const set of eligibleApproverIdSets) {
    for (const id of set) eligibleApproverIds.add(id);
  }
  const selfApprovalAllowed = isSoleApprover(eligibleApproverIds, userId);
  const policyVersion = prepared
    .map(member => member.policy.policyVersion)
    .sort()
    .join('|');

  const proposal = await db.core.transaction(async tx => {
    const caseId = randomUUID();
    const root = await tx.entityChange.createApproval({
      id: caseId,
      workspace,
      entity_id: prepared[0]!.entity.id,
      status: 'open',
      initiator_user_id: userId,
      created_at: now,
      updated_at: now,
      closed_at: null
    });
    const revisionId = randomUUID();
    await tx.entityChange.createBulkApprovalRevision({
      id: revisionId,
      proposal_id: root.id,
      workspace,
      revision_number: 1,
      policy_version: policyVersion,
      resolved_policy: { selfApprovalAllowed },
      message: body.message ?? null,
      created_by: userId,
      status: 'submitted',
      created_at: now,
      resolved_at: null,
      members: prepared.map(member => ({
        entity_id: member.entity.id,
        base_version: member.entity.version ?? 1,
        base_state: member.baseState,
        proposed_state: member.proposedState,
        diff: member.diff
      }))
    });

    await createGovernanceCaseInTransaction(
      tx,
      workspace,
      userId,
      {
        caseKind: ENTITY_CHANGE_CASE_BULK_KIND,
        subjectType: 'entity_change_case',
        subjectId: root.id,
        subjectVersion: revisionId,
        policyVersion,
        selfApprovalAllowed,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        payload: {
          proposalId: root.id,
          revisionId,
          entityIds: prepared.map(member => member.entity.id)
        },
        assignments
      },
      now
    );
    return root;
  });
  return await toApiBulkApproval(db, proposal, authCtx);
};

const submitProposal = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  event: AuthenticatedEvent,
  body: EntityChangeApprovalRequestBody,
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
    body.proposedState,
    authCtx
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
  if (update.owner !== entity.owner || update.project_id !== entity.project_id) {
    requireEntityAction(authCtx, entity, 'admin_entity');
  }

  const userId = event.context.user.id;
  const now = new Date();
  const proposal = await db.core.transaction(async tx => {
    let root = await tx.entityChange.getOpenApproval(workspace, canonicalEntityId);
    if (expectedProposalId != null) {
      httpAssert.true(root?.id === expectedProposalId, {
        status: 404,
        message: 'Entity proposal not found'
      });
    }
    if (root == null) {
      root = await tx.entityChange.createApproval({
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
      const previous = await tx.entityChange.getLatestApprovalRevision(workspace, root.id);
      httpAssert.true(previous?.status === 'changes_requested' || previous?.status === 'stale', {
        status: 409,
        message: 'The current entity proposal is already awaiting a decision'
      });
    }

    const previous = await tx.entityChange.getLatestApprovalRevision(workspace, root.id);
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
    const revision = await tx.entityChange.createApprovalRevision({
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
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        payload: { proposalId: root.id, revisionId: revision.id, entityId: canonicalEntityId },
        assignments
      },
      now
    );
    return root;
  });
  return await toApiApproval(db, proposal, authCtx);
};

export const submitEntityChangeApproval = (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent,
  body: EntityChangeApprovalRequestBody
) => submitProposal(db, workspace, entityId, event, body);

export const resubmitEntityChangeApproval = (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  proposalId: string,
  event: AuthenticatedEvent,
  body: EntityChangeApprovalRequestBody
) => submitProposal(db, workspace, entityId, event, body, proposalId);

export const withdrawEntityChangeApproval = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  proposalId: string,
  event: AuthenticatedEvent,
  reason?: string
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const { authCtx, entity } = await assertCanPropose(db, workspace, entityId, event);
  return withdrawApproval(db, {
    workspace,
    subjectId: entity.id,
    proposalId,
    event,
    authCtx,
    reason,
    adapter: {
      caseKind: ENTITY_CHANGE_CASE_KIND,
      subjectName: 'Entity',
      toApiApproval
    }
  });
};

export const bypassEntityApproval = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  event: AuthenticatedEvent,
  body: EntityChangeApprovalRequestBody & { reason: string }
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

    await finalizeApprovalBypass(tx, {
      workspace,
      subjectId: canonicalEntityId,
      actorUserId: event.context.user.id,
      reason: body.reason,
      now,
      adapter: { caseKind: ENTITY_CHANGE_CASE_KIND }
    });
    return row;
  });
  httpAssert.present(updated, {
    status: 409,
    statusText: 'Conflict',
    message: 'The entity changed while the bypass was being applied'
  });
  return { entityId: canonicalEntityId, version: updated.version ?? 1, bypassed: true as const };
};

// Neither entity-change case kind's payload carries a projectId directly (only entity/proposal
// ids) — resolve escalation scope from the subject entity's project instead. For the bulk kind,
// a proposal can span entities from different projects; the first member's project is used as a
// reasonable default rather than adding per-entity escalation.
const resolveEntityChangeEscalationTarget = async (
  db: DatabaseAdapter,
  caseRow: GovernanceCaseDbResult
) => {
  const entityId =
    (caseRow.payload['entityId'] as string | undefined) ??
    (caseRow.payload['entityIds'] as string[] | undefined)?.[0];
  const entity = entityId ? await db.catalog.getEntity(caseRow.workspace, entityId) : null;
  return resolveScopeAwareEscalationTarget(db, caseRow.workspace, entity?.project_id ?? null);
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
          const revision = await tx.entityChange.getApprovalRevision(
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
              !equalEntityValue(revision.base_state[key], currentState[key]) &&
              !equalEntityValue(currentState[key], revision.proposed_state[key])
          );
          if (!conflicting) return 'proceed';
          await tx.entityChange.updateApprovalRevisionStatus(
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
            await tx.entityChange.updateApprovalRevisionStatus(
              caseRow.workspace,
              revisionId,
              'changes_requested'
            );
          } else if (decision === 'reject') {
            await tx.entityChange.updateApprovalRevisionStatus(
              caseRow.workspace,
              revisionId,
              'rejected',
              new Date()
            );
            await tx.entityChange.updateApprovalStatus(
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
          const revision = await tx.entityChange.getApprovalRevision(caseRow.workspace, revisionId);
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
              !equalEntityValue(revision.base_state[key], currentState[key]) &&
              !equalEntityValue(currentState[key], revision.proposed_state[key])
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
          const nextDescription = String(next['description'] ?? '');
          const nextOwner = (next['owner'] as string | null) ?? null;
          const nextLifecycle = (next['lifecycle'] as string | null) ?? null;
          const nextData = (next['data'] as Record<string, unknown>) ?? {};
          const nextSchemaId = String(next['schema_id']);
          // Recompute rather than trust the frozen value on `revision.proposed_state` — untouched
          // fields above were just reconciled against the entity's current state, so the
          // completeness score must reflect that same merged state, not the state at proposal time.
          const nextSchema = await tx.catalog.getSchema(caseRow.workspace, nextSchemaId);
          httpAssert.present(nextSchema, {
            status: 409,
            message: 'The entity schema no longer exists'
          });
          const updated = await updateEntityWithAuditIfVersion(tx, {
            workspace: caseRow.workspace,
            entityId,
            previous: entity,
            next: {
              slug: String(next['slug']),
              namespace: String(next['namespace']),
              name: String(next['name']),
              description: nextDescription,
              owner: nextOwner,
              lifecycle: nextLifecycle,
              target_lifecycle: (next['target_lifecycle'] as string | null) ?? null,
              target_lifecycle_date: (next['target_lifecycle_date'] as string | null) ?? null,
              tags: Array.isArray(next['tags'])
                ? next['tags'].filter((value): value is string => typeof value === 'string')
                : [],
              links: Array.isArray(next['links']) ? next['links'] : [],
              schema_id: nextSchemaId,
              data: nextData,
              project_id: (next['project_id'] as string | null) ?? null,
              updated_at: new Date(),
              completeness: computeEntityCompleteness(
                {
                  description: nextDescription,
                  owner: nextOwner,
                  lifecycle: nextLifecycle,
                  data: nextData
                },
                nextSchema
              )
            },
            expectedVersion: entity.version ?? 1,
            actor: {
              id: event.actor_user_id ?? caseRow.initiator_user_id ?? 'system',
              displayName: actor?.display_name ?? null
            },
            auditMetadata: { governanceCaseId: caseRow.id, proposalId, revisionId },
            versionKind: 'case_applied',
            appliedCaseRevisionId: revisionId
          });
          httpAssert.present(updated, {
            status: 409,
            statusText: 'Conflict',
            message: 'The entity changed after this proposal was submitted'
          });
          await tx.entityChange.updateApprovalRevisionStatus(
            caseRow.workspace,
            revisionId,
            'approved',
            new Date()
          );
          await tx.entityChange.updateApprovalStatus(
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
        },
        reminderWindows: { approachingDays: [2], overdueDays: [1, 5] },
        escalation: { overdueDays: 5, target: resolveEntityChangeEscalationTarget }
      }
    ],
    [
      ENTITY_CHANGE_CASE_BULK_KIND,
      {
        subjectVisible: async (
          db,
          authCtx: AuthorizationContext,
          workspace: string,
          subjectId: string
        ) => {
          const revision = await db.entityChange.getLatestApprovalRevision(workspace, subjectId);
          if (!revision) return false;
          const members = await db.entityChange.getApprovalRevisionMembers(workspace, revision.id);
          if (members.length === 0) return false;
          for (const member of members) {
            const entity = await db.catalog.getEntity(workspace, member.entity_id);
            if (!entity || !permissionChecker.hasEntityPermission(authCtx, entity, 'view_entity')) {
              return false;
            }
          }
          return true;
        },
        beforeDecision: async (tx, { case: caseRow, decision }) => {
          if (decision !== 'approve') return 'proceed';
          const revisionId = String(caseRow.payload['revisionId']);
          const members = await tx.entityChange.getApprovalRevisionMembers(
            caseRow.workspace,
            revisionId
          );
          if (members.length === 0) return 'proceed';
          let anyConflicting = false;
          for (const member of members) {
            const entity = await tx.catalog.getEntity(caseRow.workspace, member.entity_id);
            if (!entity) continue;
            const currentState = entityState(entity);
            const conflicting = Object.keys(member.diff).some(
              key =>
                !equalEntityValue(member.base_state[key], currentState[key]) &&
                !equalEntityValue(currentState[key], member.proposed_state[key])
            );
            if (conflicting) {
              anyConflicting = true;
              break;
            }
          }
          if (!anyConflicting) return 'proceed';
          await tx.entityChange.updateApprovalRevisionStatus(
            caseRow.workspace,
            revisionId,
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
            await tx.entityChange.updateApprovalRevisionStatus(
              caseRow.workspace,
              revisionId,
              'changes_requested'
            );
          } else if (decision === 'reject') {
            await tx.entityChange.updateApprovalRevisionStatus(
              caseRow.workspace,
              revisionId,
              'rejected',
              new Date()
            );
            await tx.entityChange.updateApprovalStatus(
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
          const members = await tx.entityChange.getApprovalRevisionMembers(
            caseRow.workspace,
            revisionId
          );
          httpAssert.true(members.length > 0, {
            status: 409,
            message: 'The proposal revision no longer exists'
          });

          const resolvedMembers: {
            entity: Entity;
            next: Record<string, unknown>;
            nextSchema: NonNullable<Awaited<ReturnType<DatabaseAdapter['catalog']['getSchema']>>>;
          }[] = [];
          for (const member of members) {
            const entity = await tx.catalog.getEntity(caseRow.workspace, member.entity_id);
            httpAssert.present(entity, {
              status: 409,
              message: 'The governed entity no longer exists'
            });
            const currentState = entityState(entity);
            const touchedKeys = Object.keys(member.diff);
            const conflictingKeys = touchedKeys.filter(
              key =>
                !equalEntityValue(member.base_state[key], currentState[key]) &&
                !equalEntityValue(currentState[key], member.proposed_state[key])
            );
            httpAssert.true(conflictingKeys.length === 0, {
              status: 409,
              statusText: 'Conflict',
              message: `The proposal is stale because ${entity.name} changed in: ${conflictingKeys.join(', ')}`
            });
            const next = { ...member.proposed_state };
            for (const key of mutableStateKeys) {
              if (!touchedKeys.includes(key)) next[key] = currentState[key];
            }
            const nextSchemaId = String(next['schema_id']);
            const nextSchema = await tx.catalog.getSchema(caseRow.workspace, nextSchemaId);
            httpAssert.present(nextSchema, {
              status: 409,
              message: 'The entity schema no longer exists'
            });
            resolvedMembers.push({ entity, next, nextSchema });
          }

          const actor = event.actor_user_id ? await tx.auth.getUser(event.actor_user_id) : null;
          const appliedVersions: { entityId: string; version: number }[] = [];
          for (const { entity, next, nextSchema } of resolvedMembers) {
            const nextDescription = String(next['description'] ?? '');
            const nextOwner = (next['owner'] as string | null) ?? null;
            const nextLifecycle = (next['lifecycle'] as string | null) ?? null;
            const nextData = (next['data'] as Record<string, unknown>) ?? {};
            const nextSchemaId = String(next['schema_id']);
            const updated = await updateEntityWithAuditIfVersion(tx, {
              workspace: caseRow.workspace,
              entityId: entity.id,
              previous: entity,
              next: {
                slug: String(next['slug']),
                namespace: String(next['namespace']),
                name: String(next['name']),
                description: nextDescription,
                owner: nextOwner,
                lifecycle: nextLifecycle,
                target_lifecycle: (next['target_lifecycle'] as string | null) ?? null,
                target_lifecycle_date: (next['target_lifecycle_date'] as string | null) ?? null,
                tags: Array.isArray(next['tags'])
                  ? next['tags'].filter((value): value is string => typeof value === 'string')
                  : [],
                links: Array.isArray(next['links']) ? next['links'] : [],
                schema_id: nextSchemaId,
                data: nextData,
                project_id: (next['project_id'] as string | null) ?? null,
                updated_at: new Date(),
                completeness: computeEntityCompleteness(
                  {
                    description: nextDescription,
                    owner: nextOwner,
                    lifecycle: nextLifecycle,
                    data: nextData
                  },
                  nextSchema
                )
              },
              expectedVersion: entity.version ?? 1,
              actor: {
                id: event.actor_user_id ?? caseRow.initiator_user_id ?? 'system',
                displayName: actor?.display_name ?? null
              },
              auditMetadata: { governanceCaseId: caseRow.id, proposalId, revisionId },
              versionKind: 'case_applied',
              appliedCaseRevisionId: revisionId
            });
            httpAssert.present(updated, {
              status: 409,
              statusText: 'Conflict',
              message: `${entity.name} changed after this proposal was submitted`
            });
            appliedVersions.push({ entityId: entity.id, version: updated.version ?? 1 });
          }

          await tx.entityChange.updateApprovalRevisionStatus(
            caseRow.workspace,
            revisionId,
            'approved',
            new Date()
          );
          await tx.entityChange.updateApprovalStatus(
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
            metadata: {
              proposalId,
              revisionId,
              entityIds: appliedVersions.map(entry => entry.entityId),
              appliedVersions
            }
          });
        },
        reminderWindows: { approachingDays: [2], overdueDays: [1, 5] },
        escalation: { overdueDays: 5, target: resolveEntityChangeEscalationTarget }
      }
    ]
  ]);

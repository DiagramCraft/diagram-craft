import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { Entity, EntityDbUpdate } from './db/catalogDatabase';
import {
  buildApiEntityAuthCtx as buildApiAuthCtx,
  requireEntityAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import { buildEntityDependents, type DependentRecord } from './dataHelpers';
import { listAllCatalogEntities } from './entityLoader';
import { updateEntityWithAuditIfVersion } from './entityMutations';
import { listEligibleApproverIds, isSoleApprover } from './entityChangeOperations';
import type {
  AcknowledgeDeprecationBody,
  CancelDeprecationBody,
  DeprecationAck,
  DeprecationCase,
  DeprecationImpactEntry,
  FinalizeDeprecationBody,
  PostponeDeprecationBody,
  ProposeDeprecationBody
} from '@arch-register/api-types/entityDeprecationContract';
import type {
  GovernanceAssignmentDbResult,
  GovernanceCaseDbResult
} from '../governance/db/governanceDatabase';
import type { EntityDeprecationAckDbResult } from './db/entityDeprecationDatabase';
import {
  createGovernanceCaseInTransaction,
  decideGovernanceAssignment,
  recordGovernanceEvent,
  resolveAssignmentNotifications,
  resolveCaseNotifications
} from '../governance/governanceOperations';
import { isEligibleForAssignment } from '../governance/governanceEligibility';
import type { GovernanceRegistry } from '../governance/governanceRegistry';
import { PermissionChecker } from '@arch-register/permissions';

export const ENTITY_DEPRECATION_CASE_KIND = 'entity.deprecation';
const DEPRECATION_POLICY_VERSION = 'entity.deprecation:v1';

const permissionChecker = new PermissionChecker();

// ── Impact calculation ─────────────────────────────────────────

const toImpactEntry = (
  dependent: DependentRecord,
  entityLookup: Map<string, Entity>
): DeprecationImpactEntry => ({
  entityId: dependent.entityId,
  entityName: dependent.entityName,
  entitySlug: dependent.entitySlug,
  entitySchemaId: dependent.entitySchemaId,
  schemaName: dependent.schemaName,
  ownerTeamId: entityLookup.get(dependent.entityId)?.owner ?? null,
  fieldName: dependent.fieldName,
  kind: dependent.kind
});

const computeDirectImpact = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string
): Promise<DeprecationImpactEntry[]> => {
  const [schemas, entities] = await Promise.all([
    db.catalog.listSchemas(workspace),
    listAllCatalogEntities(db, workspace)
  ]);
  const entityLookup: Map<string, Entity> = new Map(entities.map(e => [e.id, e]));
  const { dependents } = buildEntityDependents(entityId, entities, schemas, { transitive: false });
  return dependents.map(dependent => toImpactEntry(dependent, entityLookup));
};

const groupByOwnerTeam = (
  impact: DeprecationImpactEntry[]
): Map<string, DeprecationImpactEntry[]> => {
  const byTeam = new Map<string, DeprecationImpactEntry[]>();
  for (const entry of impact) {
    if (!entry.ownerTeamId) continue;
    if (!byTeam.has(entry.ownerTeamId)) byTeam.set(entry.ownerTeamId, []);
    byTeam.get(entry.ownerTeamId)!.push(entry);
  }
  return byTeam;
};

// ── Deprecated lifecycle state resolution ──────────────────────

export const getDeprecatedLifecycleStateId = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<string> => {
  const states = await db.workspace.listLifecycleStates(workspace);
  const deprecated = states.find(state => state.is_deprecated_state);
  httpAssert.present(deprecated, {
    status: 409,
    statusText: 'Conflict',
    message:
      'This workspace has not configured a "deprecated" lifecycle state. An administrator must mark one in workspace lifecycle settings before entities can be deprecated.'
  });
  return deprecated.id;
};

// ── Entity mutation helper ──────────────────────────────────────

const fullEntityUpdate = (entity: Entity, overrides: Partial<EntityDbUpdate>): EntityDbUpdate => ({
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
  updated_at: new Date(),
  ...overrides
});

// ── Eligibility ──────────────────────────────────────────────────

const isOwnerTeamAdmin = (authCtx: Parameters<typeof requireEntityAction>[0], entity: Entity) =>
  permissionChecker.hasEntityPermission(authCtx, entity, 'admin_entity');

const isWorkspaceApprover = (authCtx: Parameters<typeof requireEntityAction>[0]) =>
  permissionChecker.hasWorkspaceCapability(authCtx, 'ent.approve');

// ── API shaping ──────────────────────────────────────────────────

const toApiAck = (
  ack: EntityDeprecationAckDbResult,
  affectedEntityIds: string[]
): DeprecationAck => ({
  id: ack.id,
  caseId: ack.case_id,
  ownerTeamId: ack.owner_team_id,
  affectedEntityIds,
  status: ack.status,
  assignmentId: ack.assignment_id,
  actorUserId: ack.actor_user_id,
  comment: ack.comment,
  plannedRemediation: ack.planned_remediation,
  remediationProjectId: ack.remediation_project_id,
  targetRemediationDate: ack.target_remediation_date,
  riskAccepted: ack.risk_accepted,
  createdAt: ack.created_at.toISOString(),
  resolvedAt: ack.resolved_at?.toISOString() ?? null
});

const toApiCase = async (
  db: DatabaseAdapter,
  caseRow: GovernanceCaseDbResult,
  entity: Entity
): Promise<DeprecationCase> => {
  const [assignments, acks, currentImpact] = await Promise.all([
    db.governance.listAssignmentsForCase(caseRow.id),
    db.entityDeprecation.listAcksForCase(caseRow.id),
    computeDirectImpact(db, caseRow.workspace, caseRow.subject_id)
  ]);
  const baselineImpact = (caseRow.payload['baselineImpact'] as DeprecationImpactEntry[]) ?? [];
  const phase = assignments.some(a => a.action === 'acknowledge')
    ? 'scheduled'
    : 'pending_approval';
  const targetDate = entity.target_lifecycle_date ?? String(caseRow.payload['targetDate']);
  const overdue =
    caseRow.status === 'open' && phase === 'scheduled' && Date.now() > Date.parse(targetDate);
  const knownEntitiesByTeam = new Map<string, Set<string>>();
  for (const entry of [...baselineImpact, ...currentImpact]) {
    if (!entry.ownerTeamId) continue;
    if (!knownEntitiesByTeam.has(entry.ownerTeamId))
      knownEntitiesByTeam.set(entry.ownerTeamId, new Set());
    knownEntitiesByTeam.get(entry.ownerTeamId)!.add(entry.entityId);
  }

  return {
    id: caseRow.id,
    workspace: caseRow.workspace,
    entityId: caseRow.subject_id,
    status: caseRow.status,
    phase,
    outcome: caseRow.outcome,
    reason: String(caseRow.payload['reason'] ?? ''),
    targetDate,
    successorEntityId: (caseRow.payload['successorEntityId'] as string | null) ?? null,
    projectId: (caseRow.payload['projectId'] as string | null) ?? null,
    notes: (caseRow.payload['notes'] as string | null) ?? null,
    baselineImpact,
    currentImpact,
    overdue,
    initiatorUserId: caseRow.initiator_user_id,
    createdAt: caseRow.created_at.toISOString(),
    approveAssignmentIds: assignments.filter(a => a.action === 'approve').map(a => a.id),
    acks: acks.map(ack => toApiAck(ack, [...(knownEntitiesByTeam.get(ack.owner_team_id) ?? [])]))
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

const getOpenCase = async (db: DatabaseAdapter, workspace: string, entityId: string) => {
  const cases = await db.governance.listCases(workspace, {
    caseKind: ENTITY_DEPRECATION_CASE_KIND,
    subjectId: entityId,
    status: 'open'
  });
  return cases[0] ?? null;
};

const requireCase = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  caseId: string
): Promise<GovernanceCaseDbResult> => {
  const caseRow = await db.governance.getCase(workspace, caseId);
  httpAssert.present(caseRow, { status: 404, message: 'Deprecation case not found' });
  httpAssert.true(
    caseRow.case_kind === ENTITY_DEPRECATION_CASE_KIND && caseRow.subject_id === entityId,
    { status: 404, message: 'Deprecation case not found' }
  );
  return caseRow;
};

// ── Public read ──────────────────────────────────────────────────

export const getEntityDeprecation = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<DeprecationCase | null> => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: 'Entity not found' });
  requireEntityAction(authCtx, entity, 'view_entity');
  const caseRow = await getOpenCase(db, workspace, entity.id);
  return caseRow ? await toApiCase(db, caseRow, entity) : null;
};

// ── Propose ──────────────────────────────────────────────────────

export const proposeEntityDeprecation = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  event: AuthenticatedEvent,
  body: ProposeDeprecationBody
): Promise<DeprecationCase> => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const { entity } = await assertCanPropose(db, workspace, entityId, event);
  const canonicalEntityId = entity.id;
  const schema = await db.catalog.getSchema(workspace, entity.schema_id);
  httpAssert.present(schema, { status: 404, message: 'Entity schema not found' });
  httpAssert.true((schema.deprecation_policy ?? 'disabled') === 'required', {
    status: 409,
    statusText: 'Conflict',
    message: "The deprecation workflow is not enabled for this entity's schema"
  });
  const deprecatedStateId = await getDeprecatedLifecycleStateId(db, workspace);
  httpAssert.true(entity.lifecycle !== deprecatedStateId, {
    status: 409,
    statusText: 'Conflict',
    message: 'This entity is already in the deprecated lifecycle state'
  });
  httpAssert.true(body.baseVersion === (entity.version ?? 1), {
    status: 409,
    statusText: 'Conflict',
    message: 'The entity changed since this proposal was prepared'
  });
  httpAssert.true(!Number.isNaN(Date.parse(body.targetDate)), {
    status: 400,
    message: 'The target deprecation date is not a valid date'
  });
  const existingOpenCase = await getOpenCase(db, workspace, canonicalEntityId);
  httpAssert.true(existingOpenCase == null, {
    status: 409,
    statusText: 'Conflict',
    message: 'Only one active deprecation case is allowed per entity'
  });

  if (body.successorEntityId) {
    const successor = await db.catalog.getEntity(workspace, body.successorEntityId);
    httpAssert.present(successor, { status: 400, message: 'The successor entity does not exist' });
  }
  if (body.projectId) {
    const project = await db.project.getProject(workspace, body.projectId);
    httpAssert.present(project, { status: 400, message: 'The related project does not exist' });
  }

  const baselineImpact = await computeDirectImpact(db, workspace, canonicalEntityId);

  const eligibleApproverIds = await listEligibleApproverIds(
    db,
    workspace,
    entity.owner ? entity.owner : null
  );
  const userId = event.context.user.id;
  const selfApprovalAllowed = isSoleApprover(eligibleApproverIds, userId);

  const assignments = entity.owner
    ? [
        {
          action: 'approve' as const,
          target: {
            type: 'team_role' as const,
            teamId: entity.owner,
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

  const now = new Date();
  const caseRow = await db.core.transaction(async tx =>
    createGovernanceCaseInTransaction(
      tx,
      workspace,
      userId,
      {
        caseKind: ENTITY_DEPRECATION_CASE_KIND,
        subjectType: 'entity',
        subjectId: canonicalEntityId,
        subjectVersion: null,
        policyVersion: DEPRECATION_POLICY_VERSION,
        selfApprovalAllowed,
        payload: {
          reason: body.reason,
          targetDate: body.targetDate,
          successorEntityId: body.successorEntityId ?? null,
          projectId: body.projectId ?? null,
          notes: body.notes ?? null,
          baselineImpact
        },
        assignments
      },
      now
    )
  );
  return await toApiCase(db, caseRow, entity);
};

// ── Governance registry (approve / acknowledge domain effects) ──

type PendingAckCompletion = {
  assignmentId: string;
  actorUserId: string;
  comment: string | null;
  plannedRemediation: string | null;
  remediationProjectId: string | null;
  targetRemediationDate: string | null;
  riskAccepted: boolean;
};

export const createDeprecationGovernanceRegistry = (
  pendingAck?: PendingAckCompletion
): GovernanceRegistry =>
  new Map([
    [
      ENTITY_DEPRECATION_CASE_KIND,
      {
        subjectVisible: async (db, authCtx, workspace, subjectId) => {
          const entity = await db.catalog.getEntity(workspace, subjectId);
          return (
            entity != null && permissionChecker.hasEntityPermission(authCtx, entity, 'view_entity')
          );
        },
        independentAssignmentActions: new Set(['acknowledge' as const]),
        handleDecision: async (tx, { event, decision }) => {
          if (decision !== 'acknowledge' || !pendingAck) return;
          if (String(event.metadata['assignmentId']) !== pendingAck.assignmentId) return;
          await tx.entityDeprecation.completeAckIfOpen(pendingAck.assignmentId, {
            actor_user_id: pendingAck.actorUserId,
            comment: pendingAck.comment,
            planned_remediation: pendingAck.plannedRemediation,
            remediation_project_id: pendingAck.remediationProjectId,
            target_remediation_date: pendingAck.targetRemediationDate,
            risk_accepted: pendingAck.riskAccepted,
            resolved_at: new Date()
          });
        },
        applyDomainEffect: async (tx, { case: caseRow, event }) => {
          const entityId = caseRow.subject_id;
          const entity = await tx.catalog.getEntity(caseRow.workspace, entityId);
          httpAssert.present(entity, {
            status: 409,
            message: 'The governed entity no longer exists'
          });
          const deprecatedStateId = await getDeprecatedLifecycleStateId(tx, caseRow.workspace);
          const targetDate = String(caseRow.payload['targetDate']);
          const actor = event.actor_user_id ? await tx.auth.getUser(event.actor_user_id) : null;
          const updated = await updateEntityWithAuditIfVersion(tx, {
            workspace: caseRow.workspace,
            entityId,
            previous: entity,
            next: fullEntityUpdate(entity, {
              target_lifecycle: deprecatedStateId,
              target_lifecycle_date: targetDate
            }),
            expectedVersion: entity.version ?? 1,
            actor: {
              id: event.actor_user_id ?? caseRow.initiator_user_id ?? 'system',
              displayName: actor?.display_name ?? null
            },
            auditMetadata: { governanceCaseId: caseRow.id, deprecationApproved: true }
          });
          httpAssert.present(updated, {
            status: 409,
            statusText: 'Conflict',
            message: 'The entity changed after this deprecation was proposed'
          });

          const baselineImpact =
            (caseRow.payload['baselineImpact'] as DeprecationImpactEntry[]) ?? [];
          const byTeam = groupByOwnerTeam(baselineImpact);
          const now = new Date();
          for (const [teamId] of byTeam) {
            const assignment = await tx.governance.createAssignment({
              id: randomUUID(),
              case_id: caseRow.id,
              workspace: caseRow.workspace,
              action: 'acknowledge',
              target_type: 'team_role',
              target_user_id: null,
              target_team_id: teamId,
              target_team_role: 'team_admin',
              target_capability: null,
              created_at: now
            });
            await tx.entityDeprecation.createAck({
              id: randomUUID(),
              case_id: caseRow.id,
              workspace: caseRow.workspace,
              owner_team_id: teamId,
              assignment_id: assignment.id,
              created_at: now
            });
          }

          const hasUnowned = baselineImpact.some(entry => !entry.ownerTeamId);
          if (hasUnowned) {
            await tx.governance.createAssignment({
              id: randomUUID(),
              case_id: caseRow.id,
              workspace: caseRow.workspace,
              action: 'acknowledge',
              target_type: 'capability',
              target_user_id: null,
              target_team_id: null,
              target_team_role: null,
              target_capability: 'ent.approve',
              created_at: now
            });
          }

          await recordGovernanceEvent(tx, caseRow, {
            eventType: 'domain_effect_applied',
            actorUserId: event.actor_user_id,
            previousStatus: caseRow.status,
            resultingStatus: caseRow.status,
            reason: null,
            metadata: {
              entityId,
              entityVersion: updated.version ?? 1,
              acknowledgingTeams: [...byTeam.keys()],
              hasUnownedDependents: hasUnowned
            }
          });
        }
      }
    ]
  ]);

// ── Acknowledge ──────────────────────────────────────────────────

export const acknowledgeEntityDeprecation = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: AcknowledgeDeprecationBody
): Promise<DeprecationCase> => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: 'Entity not found' });
  requireEntityAction(authCtx, entity, 'view_entity');
  const caseRow = await requireCase(db, workspace, entity.id, caseId);

  const userId = event.context.user.id;
  const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
  const assignment = assignments.find(
    (a: GovernanceAssignmentDbResult) =>
      a.action === 'acknowledge' &&
      a.status === 'open' &&
      isEligibleForAssignment(authCtx, userId, a)
  );
  httpAssert.present(assignment, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You do not have an open acknowledgement task for this deprecation'
  });

  const registry = createDeprecationGovernanceRegistry({
    assignmentId: assignment.id,
    actorUserId: userId,
    comment: body.comment ?? null,
    plannedRemediation: body.plannedRemediation ?? null,
    remediationProjectId: body.remediationProjectId ?? null,
    targetRemediationDate: body.targetRemediationDate ?? null,
    riskAccepted: body.riskAccepted ?? false
  });

  await decideGovernanceAssignment(
    db,
    workspace,
    assignment.id,
    event,
    { decision: 'acknowledge', idempotencyKey: body.idempotencyKey },
    registry
  );
  const [refreshedEntity, refreshedCase] = await Promise.all([
    db.catalog.getEntity(workspace, entityId),
    db.governance.getCase(workspace, caseRow.id)
  ]);
  httpAssert.present(refreshedCase, { status: 404, message: 'Deprecation case not found' });
  return await toApiCase(db, refreshedCase, refreshedEntity ?? entity);
};

// ── Refresh scope ─────────────────────────────────────────────────

export const refreshEntityDeprecationScope = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<DeprecationCase> => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: 'Entity not found' });
  requireEntityAction(authCtx, entity, 'view_entity');
  const caseRow = await requireCase(db, workspace, entity.id, caseId);
  httpAssert.true(caseRow.status === 'open', {
    status: 409,
    statusText: 'Conflict',
    message: 'Only an open deprecation case can be refreshed'
  });
  httpAssert.true(isOwnerTeamAdmin(authCtx, entity) || isWorkspaceApprover(authCtx), {
    status: 403,
    statusText: 'Forbidden',
    message: 'You cannot refresh this deprecation scope'
  });

  const currentImpact = await computeDirectImpact(db, workspace, entity.id);
  const existingAcks = await db.entityDeprecation.listAcksForCase(caseRow.id);
  const knownTeams = new Set(existingAcks.map(ack => ack.owner_team_id));
  const byTeam = groupByOwnerTeam(currentImpact);
  const newlyAffectedTeams = [...byTeam.keys()].filter(teamId => !knownTeams.has(teamId));

  const baselineImpact = (caseRow.payload['baselineImpact'] as DeprecationImpactEntry[]) ?? [];
  const baselineIds = new Set(baselineImpact.map(entry => entry.entityId));
  const currentIds = new Set(currentImpact.map(entry => entry.entityId));
  const addedEntityIds = [...currentIds].filter(id => !baselineIds.has(id));
  const removedEntityIds = [...baselineIds].filter(id => !currentIds.has(id));

  const now = new Date();
  const updatedCase = await db.core.transaction(async tx => {
    for (const teamId of newlyAffectedTeams) {
      const assignment = await tx.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'acknowledge',
        target_type: 'team_role',
        target_user_id: null,
        target_team_id: teamId,
        target_team_role: 'team_admin',
        target_capability: null,
        created_at: now
      });
      await tx.entityDeprecation.createAck({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        owner_team_id: teamId,
        assignment_id: assignment.id,
        created_at: now
      });
    }
    return await recordGovernanceEvent(tx, caseRow, {
      eventType: 'scope_refreshed',
      actorUserId: event.context.user.id,
      previousStatus: caseRow.status,
      resultingStatus: caseRow.status,
      reason: null,
      metadata: { newlyAffectedTeams, addedEntityIds, removedEntityIds }
    }).then(() => caseRow);
  });
  return await toApiCase(db, updatedCase, entity);
};

// ── Postpone ───────────────────────────────────────────────────────

export const postponeEntityDeprecation = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: PostponeDeprecationBody
): Promise<DeprecationCase> => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: 'Entity not found' });
  requireEntityAction(authCtx, entity, 'view_entity');
  const caseRow = await requireCase(db, workspace, entity.id, caseId);
  httpAssert.true(caseRow.status === 'open', {
    status: 409,
    statusText: 'Conflict',
    message: 'Only an open deprecation case can be postponed'
  });
  httpAssert.true(entity.target_lifecycle_date != null, {
    status: 409,
    statusText: 'Conflict',
    message: 'This deprecation has not yet been approved and scheduled'
  });
  httpAssert.true(isOwnerTeamAdmin(authCtx, entity) || isWorkspaceApprover(authCtx), {
    status: 403,
    statusText: 'Forbidden',
    message: 'You cannot postpone this deprecation'
  });
  httpAssert.true(!Number.isNaN(Date.parse(body.targetDate)), {
    status: 400,
    message: 'The new target date is not a valid date'
  });

  const previousTargetDate = entity.target_lifecycle_date;
  const userId = event.context.user.id;
  await db.core.transaction(async tx => {
    const current = await tx.catalog.getEntity(workspace, entityId);
    httpAssert.present(current, { status: 404, message: 'Entity not found' });
    const updated = await updateEntityWithAuditIfVersion(tx, {
      workspace,
      entityId,
      previous: current,
      next: fullEntityUpdate(current, { target_lifecycle_date: body.targetDate }),
      expectedVersion: current.version ?? 1,
      actor: { id: userId, displayName: event.context.user.display_name },
      auditMetadata: { governanceCaseId: caseRow.id, deprecationPostponed: true }
    });
    httpAssert.present(updated, {
      status: 409,
      statusText: 'Conflict',
      message: 'The entity changed while the postponement was being applied'
    });
    await recordGovernanceEvent(tx, caseRow, {
      eventType: 'postponed',
      actorUserId: userId,
      previousStatus: caseRow.status,
      resultingStatus: caseRow.status,
      reason: body.reason,
      metadata: { previousTargetDate, newTargetDate: body.targetDate }
    });
  });

  const refreshedEntity = await db.catalog.getEntity(workspace, entityId);
  return await toApiCase(db, caseRow, refreshedEntity ?? entity);
};

// ── Finalize ─────────────────────────────────────────────────────

export const finalizeEntityDeprecation = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: FinalizeDeprecationBody
): Promise<DeprecationCase> => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: 'Entity not found' });
  requireEntityAction(authCtx, entity, 'view_entity');
  const caseRow = await requireCase(db, workspace, entity.id, caseId);
  httpAssert.true(caseRow.status === 'open', {
    status: 409,
    statusText: 'Conflict',
    message: 'This deprecation case is not open'
  });
  httpAssert.true(entity.target_lifecycle_date != null, {
    status: 409,
    statusText: 'Conflict',
    message: 'This deprecation has not yet been approved and scheduled'
  });

  const isOwnerAdmin = isOwnerTeamAdmin(authCtx, entity);
  const isApprover = isWorkspaceApprover(authCtx);
  httpAssert.true(isOwnerAdmin || isApprover, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You cannot finalize this deprecation'
  });

  const targetDate = Date.parse(entity.target_lifecycle_date!);
  const beforeTargetDate = Date.now() < targetDate;
  if (beforeTargetDate) {
    httpAssert.true(isApprover, {
      status: 403,
      statusText: 'Forbidden',
      message: 'Only a workspace entity approver can finalize before the target date'
    });
    requireWorkspaceCapability(authCtx, 'ent.override');
    httpAssert.true(body.override === true && !!body.reason, {
      status: 400,
      message: 'Finalizing before the target date requires an explicit override reason'
    });
  }

  const acks = await db.entityDeprecation.listAcksForCase(caseRow.id);
  const outstandingAcks = acks.filter(ack => ack.status === 'open');
  if (outstandingAcks.length > 0) {
    httpAssert.true(!!body.reason, {
      status: 400,
      message: 'Finalizing with outstanding acknowledgements requires a reason'
    });
  }

  const userId = event.context.user.id;
  const now = new Date();
  const completedCase = await db.core.transaction(async tx => {
    const current = await tx.catalog.getEntity(workspace, entityId);
    httpAssert.present(current, { status: 404, message: 'Entity not found' });
    const deprecatedStateId = await getDeprecatedLifecycleStateId(tx, workspace);
    const updated = await updateEntityWithAuditIfVersion(tx, {
      workspace,
      entityId,
      previous: current,
      next: fullEntityUpdate(current, {
        lifecycle: deprecatedStateId,
        target_lifecycle: null,
        target_lifecycle_date: null
      }),
      expectedVersion: current.version ?? 1,
      actor: { id: userId, displayName: event.context.user.display_name },
      auditMetadata: { governanceCaseId: caseRow.id, deprecationFinalized: true }
    });
    httpAssert.present(updated, {
      status: 409,
      statusText: 'Conflict',
      message: 'The entity changed while finalization was being applied'
    });

    const completed = await tx.governance.completeCaseIfOpen(caseRow.id, 'finalized', now);
    httpAssert.present(completed, {
      status: 409,
      statusText: 'Conflict',
      message: 'This deprecation case has already been completed or cancelled'
    });
    const finalizedSupersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(
      caseRow.id,
      now
    );
    await resolveAssignmentNotifications(tx, finalizedSupersededIds, now);
    await resolveCaseNotifications(tx, completed.id, now);
    await recordGovernanceEvent(tx, completed, {
      eventType: 'finalized',
      actorUserId: userId,
      previousStatus: 'open',
      resultingStatus: 'completed',
      reason: body.reason ?? null,
      metadata: { outstandingAcks: outstandingAcks.length, override: beforeTargetDate }
    });
    if (beforeTargetDate) {
      await recordGovernanceEvent(tx, completed, {
        eventType: 'finalization_override',
        actorUserId: userId,
        previousStatus: 'completed',
        resultingStatus: 'completed',
        reason: body.reason ?? null,
        metadata: {}
      });
    }
    return completed;
  });

  const refreshedEntity = await db.catalog.getEntity(workspace, entityId);
  return await toApiCase(db, completedCase, refreshedEntity ?? entity);
};

// ── Cancel ─────────────────────────────────────────────────────────

export const cancelEntityDeprecation = async (
  db: DatabaseAdapter,
  workspaceName: string,
  entityId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: CancelDeprecationBody
): Promise<DeprecationCase> => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: 'Entity not found' });
  requireEntityAction(authCtx, entity, 'view_entity');
  const caseRow = await requireCase(db, workspace, entity.id, caseId);
  httpAssert.true(caseRow.status === 'open', {
    status: 409,
    statusText: 'Conflict',
    message: 'This deprecation case is not open'
  });

  const userId = event.context.user.id;
  httpAssert.true(
    isOwnerTeamAdmin(authCtx, entity) ||
      isWorkspaceApprover(authCtx) ||
      caseRow.initiator_user_id === userId,
    { status: 403, statusText: 'Forbidden', message: 'You cannot cancel this deprecation' }
  );

  const now = new Date();
  const cancelledCase = await db.core.transaction(async tx => {
    const current = await tx.catalog.getEntity(workspace, entityId);
    httpAssert.present(current, { status: 404, message: 'Entity not found' });
    if (current.target_lifecycle != null || current.target_lifecycle_date != null) {
      await updateEntityWithAuditIfVersion(tx, {
        workspace,
        entityId,
        previous: current,
        next: fullEntityUpdate(current, { target_lifecycle: null, target_lifecycle_date: null }),
        expectedVersion: current.version ?? 1,
        actor: { id: userId, displayName: event.context.user.display_name },
        auditMetadata: { governanceCaseId: caseRow.id, deprecationCancelled: true }
      });
    }
    const cancelled = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
    httpAssert.present(cancelled, {
      status: 409,
      statusText: 'Conflict',
      message: 'This deprecation case has already been completed or cancelled'
    });
    const cancelledSupersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(
      caseRow.id,
      now
    );
    await resolveAssignmentNotifications(tx, cancelledSupersededIds, now);
    await resolveCaseNotifications(tx, cancelled.id, now);
    await recordGovernanceEvent(tx, cancelled, {
      eventType: 'cancelled',
      actorUserId: userId,
      previousStatus: 'open',
      resultingStatus: 'cancelled',
      reason: body.reason,
      metadata: {}
    });
    return cancelled;
  });

  const refreshedEntity = await db.catalog.getEntity(workspace, entityId);
  return await toApiCase(db, cancelledCase, refreshedEntity ?? entity);
};

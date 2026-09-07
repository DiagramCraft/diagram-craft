import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { runAuthorizedOperation } from '../operation';
import { updateEntity } from './entityMutationOperations';
import type { Entity, EntityVersionDbResult } from './db/catalogDatabase';
import type {
  ApplyChangeCaseRequest,
  ChangeCase
} from '@arch-register/api-types/changeCaseContract';
import {
  asRecord,
  getActiveRevisionOrThrow,
  getCaseMemberSubject,
  getCaseOrThrow,
  getProjectOrThrow,
  requireCaseEditAccess
} from './changeCaseContext';
import {
  assertChangeCaseMembersAreCurrent,
  assertChangeCaseResolutions,
  loadChangeCaseApplyMembers
} from './changeCaseConflictOperations';
import { toApiChangeCase } from './changeCaseReadOperations';
import {
  flattenRelationAuditFields,
  relationAuditContext,
  relationToBaseState
} from './relationHelpers';
import { computeChanges, logAudit } from '../audit/db/auditLogging';

const toEntityMutationPayload = (
  entity: Entity,
  state: Record<string, unknown>,
  projectId: string
) => {
  if (state['_schemaId'] != null || state['_schema'] != null) {
    return entity.project_id === projectId ? { ...state, _projectId: null } : state;
  }
  const data = asRecord(state['data']);
  return {
    _schemaId: state['schema_id'] ?? entity.schema_id,
    _name: state['name'] ?? entity.name,
    _slug: state['slug'] ?? entity.slug,
    _namespace: state['namespace'] ?? entity.namespace,
    _description: state['description'] ?? entity.description,
    _owner: state['owner'] ?? null,
    _lifecycle: state['lifecycle'] ?? null,
    _targetLifecycle: state['target_lifecycle'] ?? null,
    _targetLifecycleDate: state['target_lifecycle_date'] ?? null,
    _tags: state['tags'] ?? entity.tags,
    _links: state['links'] ?? entity.links,
    _projectId: entity.project_id === projectId ? null : (state['project_id'] ?? null),
    ...data
  };
};

/**
 * Relation proposals only change field data. Schema and endpoints remain immutable, so accept
 * either a relation base-state-shaped value or the data object directly.
 */
const toRelationMutationData = (state: Record<string, unknown>): Record<string, unknown> =>
  asRecord(state['data'] ?? state);

const applyChangeCaseInTransaction = async (
  tx: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  authCtx: AuthorizationContext,
  actor: { id: string; displayName: string | null },
  body: ApplyChangeCaseRequest
) => {
  const revision = await tx.changeCase.getActiveRevision(workspace, caseId);
  httpAssert.present(revision, {
    status: 409,
    message: 'This change case has already been applied or withdrawn'
  });
  const { members, subjects } = await loadChangeCaseApplyMembers(tx, workspace, revision);
  assertChangeCaseResolutions(members, body.resolutions);
  assertChangeCaseMembersAreCurrent(members, subjects);

  for (const member of members) {
    const subject = await getCaseMemberSubject(tx, workspace, member.entity_id);
    httpAssert.present(subject, {
      status: 404,
      message: `Record '${member.entity_id}' no longer exists`
    });
    const resolution = body.resolutions.find(candidate => candidate.memberId === member.id)!;

    if (subject.kind === 'entity') {
      const resolvedEntityData = toEntityMutationPayload(
        subject.entity,
        resolution.resolvedEntityData,
        projectId
      );
      await updateEntity(tx, workspace, member.entity_id, resolvedEntityData, authCtx, actor, {
        versionKind: 'case_applied',
        appliedCaseRevisionId: revision.id,
        projectId
      });

      const versions: EntityVersionDbResult[] = await tx.catalog.listEntityVersions(
        workspace,
        member.entity_id
      );
      const appliedVersion: EntityVersionDbResult | undefined = versions.find(
        version => version.applied_case_revision_id === revision.id
      );
      httpAssert.present(appliedVersion, {
        status: 500,
        message: `Failed to record the applied version for entity '${member.entity_id}'`
      });
      await tx.changeCase.markMemberApplied(workspace, member.id, appliedVersion.id);
    } else {
      const resolvedData = toRelationMutationData(resolution.resolvedEntityData);
      const timestamp = new Date();
      const nextRelation = await tx.relation.updateRelation(workspace, member.entity_id, {
        data: resolvedData,
        version: subject.relation.version + 1,
        updated_at: timestamp
      });
      httpAssert.present(nextRelation, {
        status: 404,
        message: `Relation '${member.entity_id}' no longer exists`
      });

      await logAudit(tx, {
        userId: actor.id,
        userDisplayName: actor.displayName,
        workspace,
        operation: 'update',
        entityType: 'relation',
        entityId: member.entity_id,
        entityName: `${nextRelation.in_entity_name} → ${nextRelation.out_entity_name}`,
        schemaId: nextRelation.schema_id,
        changes: computeChanges(
          flattenRelationAuditFields(subject.relation),
          flattenRelationAuditFields(nextRelation),
          { alwaysInclude: ['_inEntityId', '_outEntityId'] }
        ),
        metadata: {
          relation: relationAuditContext(nextRelation),
          applied_case_revision_id: revision.id
        }
      });

      const appliedVersionId = randomUUID();
      await tx.catalog.createEntityVersion({
        id: appliedVersionId,
        workspace,
        record_id: member.entity_id,
        version_number: nextRelation.version,
        kind: 'case_applied',
        commit_message: null,
        created_at: timestamp,
        created_by: actor.id,
        state: relationToBaseState(nextRelation),
        applied_case_revision_id: revision.id
      });
      await tx.changeCase.markMemberApplied(workspace, member.id, appliedVersionId);
    }
  }

  const now = new Date();
  await tx.changeCase.markRevisionApplied(workspace, revision.id, now);
  await tx.changeCase.markCaseApplied(workspace, caseId, now);

  return (await tx.changeCase.getCase(workspace, caseId))!;
};

export const applyChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: ApplyChangeCaseRequest
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to apply change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);
      await getCaseOrThrow(db, ws, caseId);
      await getActiveRevisionOrThrow(db, ws, caseId);

      const actor = {
        id: event.context.user.id,
        displayName: event.context.user.display_name
      };
      const appliedCase = await db.core.transaction(tx =>
        applyChangeCaseInTransaction(tx, ws, project.id, caseId, authCtx, actor, body)
      );

      return toApiChangeCase(db, ws, appliedCase, authCtx);
    }
  });
};

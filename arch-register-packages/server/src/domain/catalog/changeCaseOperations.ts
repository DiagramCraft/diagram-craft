import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { runAuthorizedOperation } from '../operation';
import { requireEntityAction } from '../auth/authorization';
import type {
  AddRelationChangeCaseMemberRequest,
  ChangeCase,
  UpdateChangeCaseRequest
} from '@arch-register/api-types/changeCaseContract';
import {
  assertEntityBelongsToProject,
  buildMemberInput,
  buildRelationMemberInput,
  getActiveRevisionOrThrow,
  getCaseMemberSubject,
  getCaseOrThrow,
  getProjectOrThrow,
  requireCaseEditAccess,
  resolveEffectiveDate
} from './changeCaseContext';
import {
  requireNoRestrictedCaseMemberWrites,
  requireNoRestrictedRelationCaseMemberWrites
} from './changeCaseMutationAuthorization';
import { toApiChangeCase } from './changeCaseReadOperations';
import {
  assertRelationProposalEndpointsUnchanged,
  requireRelationCaseMemberEditAccess
} from './relationHelpers';

export const addEntityToChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: { entityId: string; proposedState: Record<string, unknown> }
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to add entity to change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      httpAssert.true(changeCase.project_id === project.id, {
        status: 400,
        message: 'Change case does not belong to this project'
      });
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);

      const entity = await db.catalog.getEntity(ws, body.entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${body.entityId}' not found` });
      requireEntityAction(
        authCtx,
        entity,
        'edit_entity',
        `You do not have permission to edit entity '${entity.id}'`
      );
      await assertEntityBelongsToProject(db, ws, project.id, entity);

      await requireNoRestrictedCaseMemberWrites(db, ws, authCtx, entity, body.proposedState);

      const existingMembers = await db.changeCase.listMembers(ws, revision.id);
      httpAssert.true(!existingMembers.some(member => member.entity_id === entity.id), {
        status: 409,
        message: 'This entity is already part of the change case'
      });

      await db.changeCase.addMember(ws, revision.id, buildMemberInput(entity, body.proposedState));

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  });
};

/**
 * Relation counterpart of addEntityToChangeCase. Relations aren't project-scoped, so there is no
 * assertEntityBelongsToProject equivalent — a relation can be proposed as part of any change
 * case in the workspace as long as the caller can edit it.
 */
export const addRelationToChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: AddRelationChangeCaseMemberRequest
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to add relation to change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      httpAssert.true(changeCase.project_id === project.id, {
        status: 400,
        message: 'Change case does not belong to this project'
      });
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);

      const relation = await db.relation.getRelation(ws, body.relationId);
      httpAssert.present(relation, {
        status: 404,
        message: `Relation '${body.relationId}' not found`
      });
      await requireRelationCaseMemberEditAccess(db, ws, authCtx, relation);
      assertRelationProposalEndpointsUnchanged(relation, body.proposedState);

      await requireNoRestrictedRelationCaseMemberWrites(
        db,
        ws,
        authCtx,
        relation,
        body.proposedState
      );

      const existingMembers = await db.changeCase.listMembers(ws, revision.id);
      httpAssert.true(!existingMembers.some(member => member.entity_id === relation.id), {
        status: 409,
        message: 'This relation is already part of the change case'
      });

      await db.changeCase.addMember(
        ws,
        revision.id,
        buildRelationMemberInput(relation, body.proposedState)
      );

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  });
};

export const removeEntityFromChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  memberId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to remove entity from change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);
      const members = await db.changeCase.listMembers(ws, revision.id);
      httpAssert.true(
        members.some(member => member.id === memberId),
        {
          status: 404,
          message: 'Change case member not found'
        }
      );
      httpAssert.true(members.length > 1, {
        status: 400,
        message: 'A change case must retain at least one entity'
      });

      const removed = await db.changeCase.removeMember(ws, memberId);
      httpAssert.present(removed, { status: 404, message: 'Change case member not found' });

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  });
};

export const updateChangeCaseMemberProposedState = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  memberId: string,
  event: AuthenticatedEvent,
  body: { proposedState: Record<string, unknown> }
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to update change case member',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);
      const members = await db.changeCase.listMembers(ws, revision.id);
      const member = members.find(candidate => candidate.id === memberId);
      httpAssert.present(member, { status: 404, message: 'Change case member not found' });

      const subject = await getCaseMemberSubject(db, ws, member.entity_id);
      httpAssert.present(subject, { status: 404, message: 'Record not found' });
      if (subject.kind === 'entity') {
        requireEntityAction(
          authCtx,
          subject.entity,
          'edit_entity',
          `You do not have permission to edit entity '${subject.entity.id}'`
        );
        await requireNoRestrictedCaseMemberWrites(
          db,
          ws,
          authCtx,
          subject.entity,
          body.proposedState
        );
      } else {
        await requireRelationCaseMemberEditAccess(db, ws, authCtx, subject.relation);
        assertRelationProposalEndpointsUnchanged(subject.relation, body.proposedState);
        await requireNoRestrictedRelationCaseMemberWrites(
          db,
          ws,
          authCtx,
          subject.relation,
          body.proposedState
        );
      }

      const updated = await db.changeCase.updateMemberProposedState(
        ws,
        memberId,
        body.proposedState,
        {}
      );
      httpAssert.present(updated, { status: 404, message: 'Change case member not found' });

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  });
};

export const updateChangeCaseFields = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: UpdateChangeCaseRequest
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to update change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);
      await getActiveRevisionOrThrow(db, ws, caseId);

      let effectiveDate: string | null | undefined;
      let milestoneId: string | null | undefined;
      if (body.targetDate !== undefined || body.milestoneId !== undefined) {
        const resolved = await resolveEffectiveDate(
          db,
          ws,
          project.id,
          body.targetDate,
          body.milestoneId
        );
        effectiveDate = resolved.effectiveDate;
        milestoneId = resolved.milestoneId;
      }

      const updated = await db.changeCase.updateCaseFields(ws, caseId, {
        name: body.name,
        target_date: effectiveDate,
        milestone_id: milestoneId,
        message: body.commitMessage
      });
      httpAssert.present(updated, { status: 404, message: `Change case '${caseId}' not found` });

      return toApiChangeCase(db, ws, updated, authCtx);
    }
  });
};

export const withdrawChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to withdraw change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);
      await getActiveRevisionOrThrow(db, ws, caseId);

      const withdrawn = await db.changeCase.withdrawCase(ws, caseId);
      httpAssert.present(withdrawn, { status: 404, message: `Change case '${caseId}' not found` });

      return toApiChangeCase(db, ws, withdrawn, authCtx);
    }
  });
};

export const deleteChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<{ success: true; message: string }> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to delete change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);

      const deleted = await db.changeCase.deleteCase(ws, caseId);
      httpAssert.present(deleted, {
        status: 409,
        message: 'Only a still-planned change case can be deleted; withdraw it instead'
      });

      return { success: true as const, message: 'Change case deleted' };
    }
  });
};

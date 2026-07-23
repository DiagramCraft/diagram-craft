import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { AuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { defineEntityOperation } from '../operation';
import {
  requireEntityAction,
  requireProjectAccess,
  requireProjectAction
} from '../auth/authorization';
import { updateEntity } from './entityMutationOperations';
import { entityToBaseState } from './entityMutations';
import type { Entity, EntityVersionDbResult } from './db/catalogDatabase';
import type {
  ChangeCaseDbResult,
  ChangeCaseMemberDbResult,
  ChangeCaseRevisionDbResult
} from './db/changeCaseDatabase';
import type {
  ChangeCase,
  ChangeCaseApplyConflict,
  ApplyChangeCaseRequest,
  CreateChangeCaseRequest,
  UpdateChangeCaseRequest
} from '@arch-register/api-types/changeCaseContract';

const getProjectOrThrow = async (db: DatabaseAdapter, ws: string, projectId: string) => {
  const project = await db.project.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  return project;
};

const assertEntityBelongsToProject = async (
  db: DatabaseAdapter,
  ws: string,
  projectId: string,
  entity: Entity
) => {
  if (entity.project_id === projectId) return;
  const linked = await db.project.isEntityLinkedToProject(ws, projectId, entity.id);
  httpAssert.true(linked, {
    status: 400,
    message: `Entity '${entity.id}' is not part of this project`
  });
};

const resolveEffectiveDate = async (
  db: DatabaseAdapter,
  ws: string,
  projectId: string,
  targetDate: string | null | undefined,
  milestoneId: string | null | undefined
): Promise<{ effectiveDate: string | null; milestoneId: string | null }> => {
  if (milestoneId == null) return { effectiveDate: targetDate ?? null, milestoneId: null };
  const milestone = await db.project.getMilestone(ws, projectId, milestoneId);
  httpAssert.present(milestone, { status: 404, message: 'Milestone not found' });
  return { effectiveDate: milestone.target_date, milestoneId: milestone.id };
};

const getCaseOrThrow = async (db: DatabaseAdapter, ws: string, caseId: string) => {
  const changeCase = await db.changeCase.getCase(ws, caseId);
  httpAssert.present(changeCase, { status: 404, message: `Change case '${caseId}' not found` });
  return changeCase;
};

const getActiveRevisionOrThrow = async (db: DatabaseAdapter, ws: string, caseId: string) => {
  const revision = await db.changeCase.getActiveRevision(ws, caseId);
  httpAssert.present(revision, {
    status: 409,
    message: 'This change case has already been applied, withdrawn, or has no active revision'
  });
  return revision;
};

const requireCaseEditAccess = (authCtx: AuthorizationContext, project: { owner: string | null }) =>
  requireProjectAction(
    authCtx,
    project.owner,
    'edit_project',
    'You do not have permission to edit change cases in this project'
  );

const toApiChangeCase = async (
  db: DatabaseAdapter,
  ws: string,
  changeCase: ChangeCaseDbResult
): Promise<ChangeCase> => {
  const revision = await db.changeCase.getLatestRevision(ws, changeCase.id);
  const members = revision ? await db.changeCase.listMembers(ws, revision.id) : [];
  return {
    id: changeCase.id,
    workspace: changeCase.workspace,
    project_id: changeCase.project_id,
    status: changeCase.status,
    name: changeCase.name,
    description: changeCase.description,
    target_date: changeCase.effective_date,
    milestone_id: changeCase.milestone_id,
    commit_message: revision?.message ?? null,
    created_at: changeCase.created_at.toISOString(),
    updated_at: changeCase.updated_at.toISOString(),
    members: members.map(toApiMember)
  };
};

const toApiMember = (member: ChangeCaseMemberDbResult) => ({
  id: member.id,
  entity_id: member.entity_id,
  base_version: member.base_version,
  base_state: member.base_state,
  proposed_state: member.proposed_state,
  applied_version_id: member.applied_version_id
});

const buildMemberInput = (entity: Entity, proposedState: Record<string, unknown>) => ({
  entity_id: entity.id,
  base_version: entity.version ?? 1,
  base_state: entityToBaseState(entity),
  proposed_state: proposedState,
  diff: {}
});

export const listChangeCasesByProject = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase[]> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve change cases' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const rows = await db.changeCase.listCasesByProject(ws, project.id);
      return Promise.all(rows.map(row => toApiChangeCase(db, ws, row)));
    }
  );
};

export const getChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      return toApiChangeCase(db, ws, changeCase);
    }
  );
};

export const createChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent,
  body: CreateChangeCaseRequest
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to create change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const entities = await Promise.all(
        body.members.map(async member => {
          const entity = await db.catalog.getEntity(ws, member.entityId);
          httpAssert.present(entity, {
            status: 404,
            message: `Entity '${member.entityId}' not found`
          });
          requireEntityAction(
            authCtx,
            entity,
            'edit_entity',
            `You do not have permission to edit entity '${entity.id}'`
          );
          await assertEntityBelongsToProject(db, ws, project.id, entity);
          return { entity, proposedState: member.proposedState };
        })
      );

      const { effectiveDate, milestoneId } = await resolveEffectiveDate(
        db,
        ws,
        project.id,
        body.targetDate,
        body.milestoneId
      );

      const changeCase = await db.changeCase.createCase({
        id: crypto.randomUUID(),
        workspace: ws,
        project_id: project.id,
        name: body.name,
        description: body.description ?? null,
        effective_date: effectiveDate,
        milestone_id: milestoneId,
        message: body.commitMessage ?? null,
        created_by: event.context.user.id,
        created_at: new Date(),
        members: entities.map(({ entity, proposedState }) =>
          buildMemberInput(entity, proposedState)
        )
      });

      return toApiChangeCase(db, ws, changeCase);
    }
  );
};

export const addEntityToChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: { entityId: string; proposedState: Record<string, unknown> }
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to add entity to change case' },
    async ({ ws, authCtx }) => {
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

      const existingMembers = await db.changeCase.listMembers(ws, revision.id);
      httpAssert.true(!existingMembers.some(member => member.entity_id === entity.id), {
        status: 409,
        message: 'This entity is already part of the change case'
      });

      await db.changeCase.addMember(ws, revision.id, buildMemberInput(entity, body.proposedState));

      return toApiChangeCase(db, ws, changeCase);
    }
  );
};

export const removeEntityFromChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  memberId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to remove entity from change case' },
    async ({ ws, authCtx }) => {
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

      return toApiChangeCase(db, ws, changeCase);
    }
  );
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
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update change case member' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);
      const members = await db.changeCase.listMembers(ws, revision.id);
      const member = members.find(candidate => candidate.id === memberId);
      httpAssert.present(member, { status: 404, message: 'Change case member not found' });

      const entity = await db.catalog.getEntity(ws, member.entity_id);
      httpAssert.present(entity, { status: 404, message: 'Entity not found' });
      requireEntityAction(
        authCtx,
        entity,
        'edit_entity',
        `You do not have permission to edit entity '${entity.id}'`
      );

      const updated = await db.changeCase.updateMemberProposedState(
        ws,
        memberId,
        body.proposedState,
        {}
      );
      httpAssert.present(updated, { status: 404, message: 'Change case member not found' });

      return toApiChangeCase(db, ws, changeCase);
    }
  );
};

export const updateChangeCaseFields = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: UpdateChangeCaseRequest
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update change case' },
    async ({ ws, authCtx }) => {
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

      return toApiChangeCase(db, ws, updated);
    }
  );
};

export const withdrawChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to withdraw change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);
      await getActiveRevisionOrThrow(db, ws, caseId);

      const withdrawn = await db.changeCase.withdrawCase(ws, caseId);
      httpAssert.present(withdrawn, { status: 404, message: `Change case '${caseId}' not found` });

      return toApiChangeCase(db, ws, withdrawn);
    }
  );
};

const buildConflicts = async (
  db: DatabaseAdapter,
  ws: string,
  revision: ChangeCaseRevisionDbResult
): Promise<{ conflicts: ChangeCaseApplyConflict[]; members: ChangeCaseMemberDbResult[] }> => {
  const members = await db.changeCase.listMembers(ws, revision.id);
  const conflicts = await Promise.all(
    members.map(async member => {
      const entity = await db.catalog.getEntity(ws, member.entity_id);
      httpAssert.present(entity, {
        status: 404,
        message: `Entity '${member.entity_id}' no longer exists`
      });
      const currentVersion = entity.version ?? 1;
      return {
        memberId: member.id,
        entityId: member.entity_id,
        baseVersion: member.base_version,
        currentVersion,
        stale: currentVersion !== member.base_version
      };
    })
  );
  return { conflicts, members };
};

export const checkChangeCaseApplyConflicts = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCaseApplyConflict[]> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to check change case conflicts' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      await getCaseOrThrow(db, ws, caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);
      const { conflicts } = await buildConflicts(db, ws, revision);
      return conflicts;
    }
  );
};

export const applyChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: ApplyChangeCaseRequest
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to apply change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);
      const revisionBeforeApply = await getActiveRevisionOrThrow(db, ws, caseId);
      const { members } = await buildConflicts(db, ws, revisionBeforeApply);

      httpAssert.true(body.resolutions.length === members.length, {
        status: 400,
        message: 'A resolution must be supplied for every member entity of this case'
      });
      for (const member of members) {
        httpAssert.true(
          body.resolutions.some(resolution => resolution.memberId === member.id),
          { status: 400, message: `Missing resolution for entity '${member.entity_id}'` }
        );
      }

      const actor = {
        id: event.context.user.id,
        displayName: event.context.user.display_name
      };

      const appliedCase = await db.core.transaction(async tx => {
        const revision = await tx.changeCase.getActiveRevision(ws, caseId);
        httpAssert.present(revision, {
          status: 409,
          message: 'This change case has already been applied or withdrawn'
        });
        const txMembers = await tx.changeCase.listMembers(ws, revision.id);

        for (const member of txMembers) {
          const entity = await tx.catalog.getEntity(ws, member.entity_id);
          httpAssert.present(entity, {
            status: 404,
            message: `Entity '${member.entity_id}' no longer exists`
          });
          httpAssert.true((entity.version ?? 1) === member.base_version, {
            status: 409,
            message: `Entity '${member.entity_id}' changed since this case was planned; conflicts must be re-resolved`
          });
        }

        for (const member of txMembers) {
          const resolution = body.resolutions.find(candidate => candidate.memberId === member.id)!;

          await updateEntity(
            tx,
            ws,
            member.entity_id,
            resolution.resolvedEntityData,
            authCtx,
            actor,
            { versionKind: 'case_applied', appliedCaseRevisionId: revision.id }
          );

          const versions: EntityVersionDbResult[] = await tx.catalog.listEntityVersions(
            ws,
            member.entity_id
          );
          const appliedVersion: EntityVersionDbResult | undefined = versions.find(
            v => v.applied_case_revision_id === revision.id
          );
          httpAssert.present(appliedVersion, {
            status: 500,
            message: `Failed to record the applied version for entity '${member.entity_id}'`
          });
          await tx.changeCase.markMemberApplied(ws, member.id, appliedVersion.id);
        }

        const now = new Date();
        await tx.changeCase.markRevisionApplied(ws, revision.id, now);
        await tx.changeCase.markCaseApplied(ws, caseId, now);

        return (await tx.changeCase.getCase(ws, caseId))!;
      });

      return toApiChangeCase(db, ws, appliedCase);
    }
  );
};

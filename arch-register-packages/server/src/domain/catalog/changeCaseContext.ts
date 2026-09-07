import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { requireProjectAction } from '../auth/authorization';
import type { Entity } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import { entityToBaseState } from './entityMutations';
import { relationToBaseState } from './relationHelpers';

export type CaseMemberSubject =
  | { kind: 'entity'; entity: Entity }
  | { kind: 'relation'; relation: RelationDbResult };

export const getProjectOrThrow = async (db: DatabaseAdapter, ws: string, projectId: string) => {
  const project = await db.project.projects.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  return project;
};

export const assertEntityBelongsToProject = async (
  db: DatabaseAdapter,
  ws: string,
  projectId: string,
  entity: Entity
) => {
  if (entity.project_id === projectId) return;
  const linked = await db.project.projectEntities.isEntityLinkedToProject(ws, projectId, entity.id);
  httpAssert.true(linked, {
    status: 400,
    message: `Entity '${entity.id}' is not part of this project`
  });
};

export const resolveEffectiveDate = async (
  db: DatabaseAdapter,
  ws: string,
  projectId: string,
  targetDate: string | null | undefined,
  milestoneId: string | null | undefined
): Promise<{ effectiveDate: string | null; milestoneId: string | null }> => {
  if (milestoneId == null) return { effectiveDate: targetDate ?? null, milestoneId: null };
  const milestone = await db.project.milestones.getMilestone(ws, projectId, milestoneId);
  httpAssert.present(milestone, { status: 404, message: 'Milestone not found' });
  return { effectiveDate: milestone.target_date, milestoneId: milestone.id };
};

export const getCaseOrThrow = async (db: DatabaseAdapter, ws: string, caseId: string) => {
  const changeCase = await db.changeCase.getCase(ws, caseId);
  httpAssert.present(changeCase, { status: 404, message: `Change case '${caseId}' not found` });
  return changeCase;
};

export const getActiveRevisionOrThrow = async (db: DatabaseAdapter, ws: string, caseId: string) => {
  const revision = await db.changeCase.getActiveRevision(ws, caseId);
  httpAssert.present(revision, {
    status: 409,
    message: 'This change case has already been applied, withdrawn, or has no active revision'
  });
  return revision;
};

export const requireCaseEditAccess = (
  authCtx: AuthorizationContext,
  project: { owner: string | null }
) =>
  requireProjectAction(
    authCtx,
    project.owner,
    'edit_project',
    'You do not have permission to edit change cases in this project'
  );

/**
 * A change-case member can refer to either an entity or a relation instance. The member table
 * intentionally does not carry a kind column, so entity lookup remains the fast/common path and
 * relation lookup is the fallback.
 */
export const getCaseMemberSubject = async (
  db: DatabaseAdapter,
  ws: string,
  recordId: string
): Promise<CaseMemberSubject | null> => {
  const entity = await db.catalog.getEntity(ws, recordId);
  if (entity) return { kind: 'entity', entity };
  const relation = await db.relation.getRelation(ws, recordId);
  if (relation) return { kind: 'relation', relation };
  return null;
};

export const asRecord = (value: unknown): Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const buildMemberInput = (
  entity: Entity,
  proposedState: Record<string, unknown>,
  projectId?: string
) => ({
  entity_id: entity.id,
  base_version: entity.version ?? 1,
  base_state: entityToBaseState(entity),
  proposed_state:
    projectId != null && entity.project_id === projectId
      ? { ...proposedState, project_id: null }
      : proposedState,
  diff: {}
});

export const buildRelationMemberInput = (
  relation: RelationDbResult,
  proposedState: Record<string, unknown>
) => ({
  entity_id: relation.id,
  base_version: relation.version,
  base_state: relationToBaseState(relation),
  proposed_state: proposedState,
  diff: {}
});

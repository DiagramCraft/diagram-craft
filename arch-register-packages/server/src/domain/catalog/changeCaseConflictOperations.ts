import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { runAuthorizedOperation } from '../operation';
import { requireProjectAccess } from '../auth/authorization';
import type {
  ChangeCaseApplyConflict,
  ApplyChangeCaseRequest
} from '@arch-register/api-types/changeCaseContract';
import type { ChangeCaseMemberDbResult, ChangeCaseRevisionDbResult } from './db/changeCaseDatabase';
import {
  getActiveRevisionOrThrow,
  getCaseMemberSubject,
  getCaseOrThrow,
  getProjectOrThrow,
  type CaseMemberSubject
} from './changeCaseContext';

export type ChangeCaseApplyMembers = {
  members: ChangeCaseMemberDbResult[];
  subjects: Map<string, CaseMemberSubject>;
};

export const getCurrentMemberVersion = (subject: CaseMemberSubject) =>
  subject.kind === 'entity' ? (subject.entity.version ?? 1) : subject.relation.version;

export const loadChangeCaseApplyMembers = async (
  db: DatabaseAdapter,
  ws: string,
  revision: ChangeCaseRevisionDbResult
): Promise<ChangeCaseApplyMembers> => {
  const members = await db.changeCase.listMembers(ws, revision.id);
  const subjects = new Map<string, CaseMemberSubject>();
  await Promise.all(
    members.map(async member => {
      const subject = await getCaseMemberSubject(db, ws, member.entity_id);
      httpAssert.present(subject, {
        status: 404,
        message: `Record '${member.entity_id}' no longer exists`
      });
      subjects.set(member.id, subject);
    })
  );
  return { members, subjects };
};

export const buildChangeCaseConflicts = async (
  db: DatabaseAdapter,
  ws: string,
  revision: ChangeCaseRevisionDbResult
): Promise<{ conflicts: ChangeCaseApplyConflict[]; members: ChangeCaseMemberDbResult[] }> => {
  const { members, subjects } = await loadChangeCaseApplyMembers(db, ws, revision);
  const conflicts = members.map(member => {
    const subject = subjects.get(member.id)!;
    const currentVersion = getCurrentMemberVersion(subject);
    return {
      memberId: member.id,
      entityId: member.entity_id,
      baseVersion: member.base_version,
      currentVersion,
      stale: currentVersion !== member.base_version
    };
  });
  return { conflicts, members };
};

export const assertChangeCaseResolutions = (
  members: ChangeCaseMemberDbResult[],
  resolutions: ApplyChangeCaseRequest['resolutions']
) => {
  httpAssert.true(resolutions.length === members.length, {
    status: 400,
    message: 'A resolution must be supplied for every member entity of this case'
  });
  for (const member of members) {
    httpAssert.true(
      resolutions.some(resolution => resolution.memberId === member.id),
      { status: 400, message: `Missing resolution for entity '${member.entity_id}'` }
    );
  }
};

export const assertChangeCaseMembersAreCurrent = (
  members: ChangeCaseMemberDbResult[],
  subjects: Map<string, CaseMemberSubject>
) => {
  for (const member of members) {
    const subject = subjects.get(member.id)!;
    httpAssert.true(getCurrentMemberVersion(subject) === member.base_version, {
      status: 409,
      message: `Record '${member.entity_id}' changed since this case was planned; conflicts must be re-resolved`
    });
  }
};

export const checkChangeCaseApplyConflicts = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCaseApplyConflict[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to check change case conflicts',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      await getCaseOrThrow(db, ws, caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);
      const { conflicts } = await buildChangeCaseConflicts(db, ws, revision);
      return conflicts;
    }
  });
};

import type { GovernanceCaseSubject } from '@arch-register/api-types/governanceContract';
import { PermissionChecker } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { runAuthorizedOperation } from '../operation';
import {
  ENTITY_CHANGE_CASE_BULK_KIND,
  ENTITY_CHANGE_CASE_KIND,
  getBulkEntityChangeApproval,
  getEntityChangeApproval
} from '../catalog/entityChangeOperations';
import { getProjectFile } from '../project/contentFileOperations';

const checker = new PermissionChecker();

export type GovernanceCaseSubjectRef = {
  caseId: string;
  caseKind: string;
  subjectType: string;
  subjectId: string;
};

type ApprovalLike = {
  id: string;
  status: string;
  revisions: { createdByName: string | null; createdAt: string; message: string | null }[];
};

const unique = (values: string[]) => [...new Set(values)];

const latestRevisionOf = (approval: ApprovalLike | null | undefined) => {
  const revision = approval?.revisions.at(-1);
  return revision
    ? {
        createdByName: revision.createdByName,
        createdAt: revision.createdAt,
        message: revision.message
      }
    : null;
};

/** Resolves an operation that may be forbidden or not found to `undefined` instead of throwing */
const orUndefined = async <T>(promise: Promise<T>): Promise<T | undefined> => {
  try {
    return await promise;
  } catch {
    return undefined;
  }
};

/**
 * Resolves the display data of many case subjects in one call. Subjects the caller
 * cannot view are left out, in which case the client falls back to the subject id.
 */
export const resolveGovernanceCaseSubjects = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  cases: GovernanceCaseSubjectRef[]
): Promise<Record<string, GovernanceCaseSubject>> => {
  const bulkIds = unique(
    cases.filter(c => c.caseKind === ENTITY_CHANGE_CASE_BULK_KIND).map(c => c.subjectId)
  );
  const changeEntityIds = unique(
    cases
      .filter(c => c.caseKind === ENTITY_CHANGE_CASE_KIND && c.subjectType === 'entity')
      .map(c => c.subjectId)
  );
  const documentIds = unique(
    cases.filter(c => c.subjectType === 'document').map(c => c.subjectId)
  );

  const [bulkResults, changeResults, documentResults] = await Promise.all([
    Promise.all(
      bulkIds.map(async id => [
        id,
        await orUndefined(getBulkEntityChangeApproval(db, workspace, id, event))
      ] as const)
    ),
    Promise.all(
      changeEntityIds.map(async id => [
        id,
        await orUndefined(getEntityChangeApproval(db, workspace, id, event))
      ] as const)
    ),
    Promise.all(
      documentIds.map(async id => [
        id,
        await orUndefined(getProjectFile(db, workspace, id, event))
      ] as const)
    )
  ]);
  const bulkById = new Map(bulkResults);
  const changeById = new Map(changeResults);
  const documentById = new Map(documentResults);

  const entityIds = new Set([
    ...cases.filter(c => c.subjectType === 'entity').map(c => c.subjectId),
    ...[...bulkById.values()].flatMap(bulk => bulk?.entityIds ?? [])
  ]);

  const entitiesById = await runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    fallback: 'Failed to resolve governance case subjects',
    operation: async ({ ws, authCtx }) => {
      if (entityIds.size === 0) return new Map<string, { publicId: string; name: string }>();
      const entities = await db.catalog.listEntities(ws);
      return new Map(
        entities
          .filter(
            entity =>
              entityIds.has(entity.id) &&
              (authCtx == null || checker.hasEntityPermission(authCtx, entity, 'view_entity'))
          )
          .map(entity => [entity.id, { publicId: entity.public_id, name: entity.name }])
      );
    }
  });

  const result: Record<string, GovernanceCaseSubject> = {};
  for (const kase of cases) {
    const isBulk = kase.caseKind === ENTITY_CHANGE_CASE_BULK_KIND;
    const bulk = isBulk ? bulkById.get(kase.subjectId) : undefined;
    const change = changeById.get(kase.subjectId);
    const entity = kase.subjectType === 'entity' ? entitiesById.get(kase.subjectId) : undefined;
    const document = kase.subjectType === 'document' ? documentById.get(kase.subjectId) : undefined;

    const bulkMembers = (bulk?.entityIds ?? []).flatMap(entityId => {
      const member = entitiesById.get(entityId);
      return member ? [{ uid: entityId, publicId: member.publicId, name: member.name }] : [];
    });
    const approval: ApprovalLike | null | undefined = isBulk
      ? bulk
      : kase.caseKind === ENTITY_CHANGE_CASE_KIND
        ? change
        : undefined;

    result[kase.caseId] = {
      label: entity?.name ?? document?.name ?? null,
      bulkMembers,
      bulkEntityCount: bulk ? bulk.entityIds.length : null,
      proposal: approval ? { id: approval.id, status: approval.status } : null,
      latestRevision: latestRevisionOf(approval)
    };
  }
  return result;
};

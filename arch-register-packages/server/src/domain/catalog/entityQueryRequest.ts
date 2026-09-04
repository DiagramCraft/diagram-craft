import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { requireProjectAccess } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import {
  buildEntityQueryForExecution,
  findEntityQueryRequestConflicts,
  parseEntityQuery,
  type EntityListQueryParams,
  type ParsedEntityQuery
} from './entityQuery';

export type EntityQueryCollectionPolicy = 'validate' | 'reject';

export type PrepareEntityQueryRequestOptions = {
  collectionPolicy?: EntityQueryCollectionPolicy;
};

export type PreparedEntityQueryRequest = {
  query: ParsedEntityQuery;
  collection: Awaited<ReturnType<DatabaseAdapter['view']['getCollection']>>;
  project: Awaited<ReturnType<DatabaseAdapter['project']['projects']['getProject']>>;
};

const assertCompatibleEntityQueryRequest = (query: EntityListQueryParams) => {
  const conflicts = findEntityQueryRequestConflicts(query);
  httpAssert.true(conflicts.length === 0, {
    status: 400,
    message: `EntityQuery conflicts with request field(s): ${conflicts.join(', ')}`
  });
};

export const prepareEntityQueryRequest = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  input: EntityListQueryParams,
  { collectionPolicy = 'validate' }: PrepareEntityQueryRequestOptions = {}
): Promise<PreparedEntityQueryRequest> => {
  const parsed = parseEntityQuery(input);
  assertCompatibleEntityQueryRequest(input);
  const query = {
    ...parsed,
    entityQuery: buildEntityQueryForExecution(input, parsed)
  };

  let collection: PreparedEntityQueryRequest['collection'] = null;
  if (query.collectionId) {
    if (collectionPolicy === 'reject') {
      httpAssert.true(false, {
        status: 400,
        message: 'Collections support table and cards views only'
      });
    }

    collection = await db.view.getCollection(authCtx.userId, workspace, query.collectionId);
    httpAssert.present(collection, { status: 404, message: 'Collection not found' });
  }

  let project: PreparedEntityQueryRequest['project'] = null;
  if (query.projectId) {
    project = await db.project.projects.getProject(workspace, query.projectId);
    httpAssert.present(project, {
      status: 404,
      message: `Project '${query.projectId}' not found`
    });
    requireProjectAccess(authCtx, project.owner);
  }

  return { query, collection, project };
};

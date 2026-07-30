import type { AuthorizationContext } from '@arch-register/permissions';
import type {
  EntityLandscapeDiff,
  EntityLandscapeDiffState,
  EntityRecord
} from '@arch-register/api-types/entityContract';
import type { DatabaseAdapter } from '../../db/database';
import { requireProjectAccess, filterVisibleEntities } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import { listAllCatalogEntities } from './entityLoader';
import { reconstructEntitiesAsOf } from './entitySnapshotReconstruction';
import { buildDiff } from './entityDiff';
import { toApiEntity } from './entityHelpers';
import type { EntityDbResult } from './db/catalogDatabase';

const entityState = (entity: EntityDbResult): Record<string, unknown> => ({
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
  project_id: entity.project_id
});

type ProjectScope = {
  projectId: string;
  candidateEntityIds: string[];
  links: Awaited<ReturnType<DatabaseAdapter['project']['listProjectEntityLinks']>>;
};

const resolveProjectScope = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  projectId: string | undefined
): Promise<ProjectScope | null> => {
  if (!projectId) return null;

  const project = await db.project.getProject(workspace, projectId);
  httpAssert.present(project, {
    status: 404,
    message: `Project '${projectId}' not found`
  });
  requireProjectAccess(authCtx, project.owner);

  const [scopedEntities, links] = await Promise.all([
    listAllCatalogEntities(db, workspace, { projectId, projectScope: 'project' }),
    db.project.listProjectEntityLinks(workspace, projectId)
  ]);
  const candidateEntityIds = [
    ...new Set([...scopedEntities.map(entity => entity.id), ...links.map(link => link.entity_id)])
  ];
  return { projectId, candidateEntityIds, links };
};

const parseStateDate = (state: EntityLandscapeDiffState): Date => new Date(state.asOf);

const reconstructState = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  state: EntityLandscapeDiffState,
  projectScope: ProjectScope | null
): Promise<EntityDbResult[]> => {
  const reconstructed = await reconstructEntitiesAsOf(
    db,
    workspace,
    parseStateDate(state),
    authCtx,
    projectScope?.candidateEntityIds,
    state.includePlannedChanges,
    projectScope?.projectId
  );

  const linkIds = projectScope
    ? new Set(
        projectScope.links
          .filter(link => link.created_at <= parseStateDate(state))
          .map(link => link.entity_id)
      )
    : null;

  const scoped = reconstructed.filter(entity => {
    if (projectScope == null) return entity.project_id == null;
    return entity.project_id === projectScope.projectId || linkIds?.has(entity.id) === true;
  });
  return filterVisibleEntities(authCtx, scoped);
};

const toApi = (entity: EntityDbResult, authCtx: AuthorizationContext): EntityRecord =>
  toApiEntity(entity, authCtx, entity.completeness);

export const diffEntityLandscapes = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  from: EntityLandscapeDiffState,
  to: EntityLandscapeDiffState
): Promise<EntityLandscapeDiff> => {
  const projectIds = [from.projectId, to.projectId].filter(
    (projectId): projectId is string => projectId != null
  );
  httpAssert.true(new Set(projectIds).size <= 1, {
    status: 400,
    message: 'Comparing different projects is not supported'
  });

  const projectScope = await resolveProjectScope(db, workspace, authCtx, projectIds[0]);
  const [fromEntities, toEntities] = await Promise.all([
    reconstructState(db, workspace, authCtx, from, projectScope),
    reconstructState(db, workspace, authCtx, to, projectScope)
  ]);
  const fromById = new Map(fromEntities.map(entity => [entity.id, entity]));
  const toById = new Map(toEntities.map(entity => [entity.id, entity]));

  const added = [...toById.values()]
    .filter(entity => !fromById.has(entity.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(entity => toApi(entity, authCtx));
  const removed = [...fromById.values()]
    .filter(entity => !toById.has(entity.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(entity => toApi(entity, authCtx));
  const changed = [...toById.values()]
    .filter(entity => fromById.has(entity.id))
    .map(entity => ({
      entity,
      diff: buildDiff(entityState(fromById.get(entity.id)!), entityState(entity))
    }))
    .filter(entry => Object.keys(entry.diff).length > 0)
    .sort((a, b) => a.entity.id.localeCompare(b.entity.id))
    .map(entry => ({ entity: toApi(entry.entity, authCtx), diff: entry.diff }));

  return { added, removed, changed };
};

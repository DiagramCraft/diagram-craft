import type { EntityUsage, EntityUsagePage } from '@arch-register/api-types/entityUsageContract';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { getEntityDependents } from './entityRelationshipOperations';
import { getEntityProjects, getEntityDiagramFiles } from '../project/projectEntityOperations';
import { listRelatedContent } from '../project/markdownListingOperations';

type EntityUsageDependents = Awaited<ReturnType<typeof getEntityDependents>>;

export const collectEntityUsage = async (
  db: DatabaseAdapter,
  workspaceId: string,
  workspaceSlug: string,
  entityId: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext,
  preloadedDependents?: EntityUsageDependents
): Promise<EntityUsage[]> => {
  const [dependents, documents, projects, diagrams] = await Promise.all([
    preloadedDependents ??
      getEntityDependents(db, workspaceId, entityId, { transitive: false }, authCtx),
    listRelatedContent(db, workspaceSlug, entityId, event),
    getEntityProjects(db, workspaceSlug, entityId, event),
    getEntityDiagramFiles(db, workspaceSlug, entityId, event)
  ]);

  const usage: EntityUsage[] = [];
  const seen = new Set<string>();
  const add = (item: EntityUsage) => {
    const key = `${item.kind}:${item.id}:${item.context ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    usage.push(item);
  };

  for (const dependent of dependents.dependents) {
    add({
      kind: dependent.kind === 'typed' ? 'relation' : 'entity',
      id:
        dependent.kind === 'typed'
          ? (dependent.relationId ?? dependent.entityId)
          : dependent.entityId,
      label: dependent.entityName,
      ...(dependent.fieldName ? { context: dependent.fieldName } : {})
    });
  }
  for (const document of documents) {
    add({ kind: 'document', id: document.file.id, label: document.file.name });
  }
  for (const project of projects) {
    add({ kind: 'project', id: project.project.id, label: project.project.name });
  }
  for (const diagram of diagrams) {
    add({ kind: 'diagram', id: diagram.file.id, label: diagram.file.name });
  }
  return usage;
};

export const getEntityUsage = async (
  db: DatabaseAdapter,
  workspaceId: string,
  workspaceSlug: string,
  entityId: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext,
  limit?: number,
  offset?: number
): Promise<EntityUsagePage> => {
  const usage = await collectEntityUsage(db, workspaceId, workspaceSlug, entityId, event, authCtx);
  const pageLimit = limit ?? 100;
  const pageOffset = offset ?? 0;
  return {
    items: usage.slice(pageOffset, pageOffset + pageLimit),
    total: usage.length
  };
};

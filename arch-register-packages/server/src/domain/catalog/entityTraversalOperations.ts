import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { EntityTraversalSubject } from '@arch-register/api-types/entityTraversalContract';
import type { DatabaseAdapter } from '../../db/database';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { httpAssert } from '../../utils/httpAssert';
import { kindAfterPath } from './entityQueryIRResolution';
import {
  executeEntityTraversal,
  type EntityTraversalPath,
  type EntityTraversalResult
} from './entityTraversal';
import { aggregateEntityTraversalResult } from './entityTraversalAggregation';
import {
  getActiveRevisionOrThrow,
  getCaseMemberSubject,
  getCaseOrThrow
} from './changeCaseContext';

/**
 * Normalizes a traversal subject (entity, relation instance, or change case) into the set of
 * entity ids that seed a traversal. A relation resolves to both its endpoints; a change case
 * resolves to the entities/relations touched by its active revision's members, with relation
 * members further resolved to their endpoints. An empty result (e.g. a case with no members) is
 * valid and yields zero traversal roots, not a not-found error.
 */
export const resolveTraversalRootEntityIds = async (
  db: DatabaseAdapter,
  ws: string,
  subject: EntityTraversalSubject
): Promise<readonly string[]> => {
  switch (subject.kind) {
    case 'entity': {
      const entity = await db.catalog.getEntity(ws, subject.entityId);
      httpAssert.present(entity, {
        status: 404,
        message: `Entity '${subject.entityId}' not found`
      });
      return [entity.id];
    }
    case 'relation': {
      const relation = await db.relation.getRelation(ws, subject.relationId);
      httpAssert.present(relation, {
        status: 404,
        message: `Relation '${subject.relationId}' not found`
      });
      return [relation.in_entity_id, relation.out_entity_id];
    }
    case 'changeCase': {
      const changeCase = await getCaseOrThrow(db, ws, subject.caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, changeCase.id);
      const members = await db.changeCase.listMembers(ws, revision.id);
      const idSets = await Promise.all(
        members.map(async member => {
          const memberSubject = await getCaseMemberSubject(db, ws, member.entity_id);
          if (!memberSubject) return [];
          return memberSubject.kind === 'entity'
            ? [memberSubject.entity.id]
            : [memberSubject.relation.in_entity_id, memberSubject.relation.out_entity_id];
        })
      );
      return [...new Set(idSets.flat())];
    }
  }
};

/**
 * The engine's result types use `readonly` arrays throughout; the ORPC output schema infers plain
 * (mutable) array types, so the result is copied one level at a time into that shape rather than
 * asserted with a cast.
 */
const toApiTraversalResult = (result: EntityTraversalResult) => ({
  roots: result.roots.map(root => ({
    rootId: root.rootId,
    paths: root.paths.map(path => ({
      pathId: path.pathId,
      occurrences: path.occurrences.map(occurrence => ({
        rootId: occurrence.rootId,
        pathId: occurrence.pathId,
        terminal: { ...occurrence.terminal },
        provenance: occurrence.provenance.map(hop => ({ ...hop }))
      })),
      distinctTerminals: path.distinctTerminals.map(terminal => ({ ...terminal })),
      duplicateCount: path.duplicateCount,
      cycleDetected: path.cycleDetected
    }))
  }))
});

export const executeSubjectTraversal = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: WorkspaceAuthorizationContext | null,
  input: {
    subject: EntityTraversalSubject;
    paths: readonly EntityTraversalPath[];
    maxDepth?: number;
    maxNodes?: number;
  }
) => {
  const entityIds = await resolveTraversalRootEntityIds(db, ws, input.subject);
  const result = await executeEntityTraversal(db, ws, authCtx, {
    root: { kind: 'ids', entityIds },
    paths: input.paths,
    maxDepth: input.maxDepth,
    maxNodes: input.maxNodes
  });
  return toApiTraversalResult(result);
};

/** Runs the same bounded traversal as the flat endpoint and aggregates its visible entity rows. */
export const executeSubjectTraversalAggregation = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: WorkspaceAuthorizationContext | null,
  input: {
    subject: EntityTraversalSubject;
    paths: readonly EntityTraversalPath[];
    maxDepth?: number;
    maxNodes?: number;
  }
) => {
  const schemas = await db.catalog.listSchemas(ws);
  const hasVisibleNumericCriticality = schemas.some(
    schema =>
      schema.fields.some(field => field.id === 'criticality' && field.type === 'number') &&
      !isFieldViewRestricted(authCtx, schema, 'criticality')
  );
  const metadataFields = [
    { context: 'entity' as const, fieldId: '_name' },
    { context: 'entity' as const, fieldId: '_slug' },
    { context: 'entity' as const, fieldId: '_owner' },
    { context: 'entity' as const, fieldId: '_lifecycle' },
    ...(hasVisibleNumericCriticality
      ? [{ context: 'entity' as const, fieldId: 'criticality' }]
      : [])
  ];
  const paths = input.paths.map(path =>
    kindAfterPath([...path.steps], 'entity') === 'entity'
      ? { ...path, sourceFields: metadataFields }
      : path
  );
  const entityIds = await resolveTraversalRootEntityIds(db, ws, input.subject);
  const result = await executeEntityTraversal(db, ws, authCtx, {
    root: { kind: 'ids', entityIds },
    paths,
    maxDepth: input.maxDepth,
    maxNodes: input.maxNodes
  });
  return aggregateEntityTraversalResult(result, schemas);
};

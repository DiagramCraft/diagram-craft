import { decodeRefs } from '../../types';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';

// Defensive cap on traversal size - containment should form a tree/DAG, but malformed data
// (a stray self-reference) shouldn't be able to hang the server.
const MAX_DESCENDANTS = 5000;

/**
 * Builds a `parentId -> childId[]` index from containment fields across `schemas`, over
 * `entities`. Mirrors `containmentFieldsBySchema`/edge construction in `getEntityTree`, just
 * inverted (child -> parent there, parent -> children here).
 */
export const buildContainmentChildrenIndex = (
  schemas: SchemaDbResult[],
  entities: EntityDbResult[]
): Map<string, string[]> => {
  const containmentFieldsBySchema = new Map<string, string[]>();
  for (const schema of schemas) {
    const cFields = schema.fields.filter(f => f.type === 'containment').map(f => f.id);
    if (cFields.length > 0) containmentFieldsBySchema.set(schema.id, cFields);
  }

  const childrenOf = new Map<string, string[]>();
  for (const entity of entities) {
    const cFields = containmentFieldsBySchema.get(entity.schema_id) ?? [];
    for (const fieldId of cFields) {
      for (const parentId of decodeRefs(entity.data[fieldId])) {
        const children = childrenOf.get(parentId);
        if (children) children.push(entity.id);
        else childrenOf.set(parentId, [entity.id]);
      }
    }
  }
  return childrenOf;
};

/**
 * Collects all descendant entity ids below `boxId` (the box entity itself is excluded), to
 * arbitrary depth. `childrenOf` should already be scoped to permission-visible entities so
 * inaccessible descendants are structurally unreachable.
 */
export const collectDescendantIds = (
  boxId: string,
  childrenOf: Map<string, string[]>
): string[] => {
  const visited = new Set<string>();
  const result: string[] = [];
  const queue = [...(childrenOf.get(boxId) ?? [])];

  while (queue.length > 0 && result.length < MAX_DESCENDANTS) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    const children = childrenOf.get(id);
    if (children) queue.push(...children);
  }

  return result;
};

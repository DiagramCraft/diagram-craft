import type { PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { pathStepContext, type PathSchemaScope } from '../pathBuilder/pathBuilderState';

// Pure helpers for editing a single leaf's relation-traversal `path` and its terminal
// field/exists choice (#2354, plan phase 5). The hop editor itself is `pathBuilder/`; this module
// only translates between "the leaf node" and "a bare list of PathSteps".

type PredicateNode = Extract<QueryNode, { kind: 'predicate' }>;

/** The traversal path carried by a predicate / relationExists leaf (empty for any other node). */
export const leafPath = (node: QueryNode): PathStep[] =>
  node.kind === 'predicate' || node.kind === 'relationExists' ? node.path : [];

/** Replace the traversal path on a predicate / relationExists leaf, keeping the terminal
 *  field/op/value of a predicate. An emptied path on a `relationExists` is nonsensical (there is
 *  no relation left to exist), so it collapses back to a flat name predicate. */
export const withLeafPath = (node: QueryNode, path: PathStep[]): QueryNode => {
  if (node.kind === 'predicate') return { ...node, path };
  if (node.kind === 'relationExists') {
    return path.length === 0
      ? { kind: 'predicate', path: [], fieldId: '_name', op: 'contains', value: '' }
      : { ...node, path };
  }
  return node;
};

/** Switch a traversal leaf to "the related record just has to exist". No-op for a flat leaf -
 *  `relationExists` requires a non-empty path. */
export const asRelationExists = (node: QueryNode): QueryNode => {
  const path = leafPath(node);
  return path.length === 0 ? node : { kind: 'relationExists', path };
};

/** Switch a traversal leaf back to matching a terminal field on the related record. */
export const asFieldPredicate = (node: QueryNode, fieldId = '_name'): PredicateNode => {
  if (node.kind === 'predicate') return node;
  return { kind: 'predicate', path: leafPath(node), fieldId, op: 'contains', value: '' };
};

type ScopeArgs = {
  rootSchemaScope: PathSchemaScope;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
};

/** The entity schema scope the last hop of `path` lands on, from the same walk the hop editor
 *  uses. `'any'` when the traversal can reach entities of any type. */
export const terminalSchemaScope = (path: PathStep[], args: ScopeArgs): PathSchemaScope =>
  pathStepContext({
    rootSchemaScope: args.rootSchemaScope,
    steps: path,
    depth: path.length,
    schemas: args.schemas,
    relationSchemas: args.relationSchemas,
    getFieldGroupAccess: args.getFieldGroupAccess
  }).currentSchemaScope;

/** The single schema id a traversal resolves to, or `null` when it's ambiguous / `'any'` - used
 *  to decide whether the terminal field picker can offer that schema's own fields. */
export const singleTerminalSchemaId = (scope: PathSchemaScope): string | null =>
  scope !== 'any' && scope.length === 1 ? (scope[0] ?? null) : null;

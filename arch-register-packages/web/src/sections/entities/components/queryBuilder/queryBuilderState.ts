import {
  MAX_PATH_HOPS,
  type EntityQuery,
  type PathStep,
  type ProjectionField,
  type QueryNode
} from '@arch-register/api-types/entityQueryIR';

// Pure, framework-free helpers behind the visual query builder (#2354). Everything here operates on
// the `EntityQuery` IR (entityQueryIR.ts) directly - the builder never invents a parallel model.
//
// Node addressing: a `NodePath` is a list of child indices from `query.root`. At each step, an
// `and`/`or` group descends into `children[i]`; a `not` node descends into its single `child`
// (index must be 0). An empty path addresses the root itself.

export type NodePath = readonly number[];

export type GroupNode = Extract<QueryNode, { kind: 'and' | 'or' }>;
export type PredicateNode = Extract<QueryNode, { kind: 'predicate' }>;
export type RelationExistsNode = Extract<QueryNode, { kind: 'relationExists' }>;
export type NotNode = Extract<QueryNode, { kind: 'not' }>;

export const isGroupNode = (node: QueryNode): node is GroupNode =>
  node.kind === 'and' || node.kind === 'or';

/** The default fresh predicate a new "Add filter" row starts as - matches FilterBuilder's own
 *  `addCondition` seed (`{ fieldId: '_name', op: 'contains', value: '' }`). */
export const emptyPredicate = (): PredicateNode => ({
  kind: 'predicate',
  path: [],
  fieldId: '_name',
  op: 'contains',
  value: ''
});

export const emptyGroup = (kind: 'and' | 'or' = 'and'): GroupNode => ({ kind, children: [] });

/** An editable root is always a group, so the builder has a stable container to add rows/groups to
 *  even when the stored IR root is a bare predicate or `not`. `entityQuerySchema` accepts any
 *  `QueryNode` as `root`, so wrapping a non-group root in a single-child `and` is a valid,
 *  round-trippable no-op for execution and printing. */
export const toEditableRoot = (query: EntityQuery): EntityQuery => {
  if (isGroupNode(query.root)) return query;
  return { ...query, root: { kind: 'and', children: [query.root] } };
};

/** Counterpart of `toEditableRoot`. The builder keeps the root as a group at all times so it stays
 *  a stable container to add sibling rows/groups to - collapsing a single-child `and` back to its
 *  child would discard exactly that container the moment the user adds a nested group to an
 *  otherwise-empty query. A root `and` (single child or not) is canonical IR that executes and
 *  prints identically, and matches what `buildEntityQueryFromBrowserFilters` already emits, so
 *  this is a deliberate identity pass-through rather than an unwrap. */
export const fromEditableRoot = (query: EntityQuery): EntityQuery => query;

const childrenOf = (node: QueryNode): QueryNode[] => {
  if (isGroupNode(node)) return node.children;
  if (node.kind === 'not') return [node.child];
  return [];
};

const withChildAt = (node: QueryNode, index: number, child: QueryNode): QueryNode => {
  if (isGroupNode(node)) {
    const next = node.children.slice();
    next[index] = child;
    return { ...node, children: next };
  }
  if (node.kind === 'not') return { ...node, child };
  return node;
};

export const getNode = (root: QueryNode, path: NodePath): QueryNode | undefined => {
  let current: QueryNode | undefined = root;
  for (const index of path) {
    if (!current) return undefined;
    current = childrenOf(current)[index];
  }
  return current;
};

/** Replace the node at `path` with `next` (or drop it when `next` is `undefined`), returning a new
 *  root. Dropping the root itself yields an empty `and` group. */
export const setNode = (
  root: QueryNode,
  path: NodePath,
  next: QueryNode | undefined
): QueryNode => {
  if (path.length === 0) return next ?? emptyGroup('and');
  const [head, ...rest] = path;
  const child = childrenOf(root)[head!];
  if (child === undefined) return root;

  if (rest.length === 0) {
    if (next === undefined) {
      if (isGroupNode(root)) {
        return { ...root, children: root.children.filter((_, i) => i !== head) };
      }
      // Removing a `not`'s only child collapses the `not` away entirely.
      return emptyGroup('and');
    }
    return withChildAt(root, head!, next);
  }

  // Removing a `not`'s only child means removing the `not` node itself from its parent, rather
  // than leaving an empty `not` (or the empty-group sentinel `setNode` would otherwise return).
  if (next === undefined && child.kind === 'not' && rest.length === 1 && rest[0] === 0) {
    return setNode(root, [head!], undefined);
  }

  return withChildAt(root, head!, setNode(child, rest, next));
};

export const updateNode = (
  root: QueryNode,
  path: NodePath,
  updater: (node: QueryNode) => QueryNode
): QueryNode => {
  const node = getNode(root, path);
  if (!node) return root;
  return setNode(root, path, updater(node));
};

export const removeNode = (root: QueryNode, path: NodePath): QueryNode =>
  setNode(root, path, undefined);

/** Append `child` to the group at `groupPath`. No-op when `groupPath` doesn't address a group. */
export const addChild = (root: QueryNode, groupPath: NodePath, child: QueryNode): QueryNode =>
  updateNode(root, groupPath, node =>
    isGroupNode(node) ? { ...node, children: [...node.children, child] } : node
  );

export const setGroupKind = (root: QueryNode, path: NodePath, kind: 'and' | 'or'): QueryNode =>
  updateNode(root, path, node => (isGroupNode(node) ? { ...node, kind } : node));

/** Wrap the node at `path` in a `not` (or unwrap it when it's already a `not`). The path stays
 *  valid either way - a `not` and its child occupy the same slot in the parent. */
export const toggleNot = (root: QueryNode, path: NodePath): QueryNode =>
  updateNode(root, path, node => (node.kind === 'not' ? node.child : { kind: 'not', child: node }));

/** Wrap the node at `path` in a new group of `kind`, making the original node that group's first
 *  child - the "group this row with…" gesture. */
export const wrapInGroup = (
  root: QueryNode,
  path: NodePath,
  kind: 'and' | 'or' = 'or'
): QueryNode => updateNode(root, path, node => ({ kind, children: [node] }));

const countNodeHops = (node: QueryNode): number => {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.children.reduce((max, child) => Math.max(max, countNodeHops(child)), 0);
    case 'not':
      return countNodeHops(node.child);
    case 'predicate':
    case 'relationExists':
      return countPathHops(node.path);
    default:
      return 0;
  }
};

const countPathHops = (path: PathStep[]): number =>
  path.reduce((total, step) => {
    const nested = 'filter' in step && step.filter ? countNodeHops(step.filter) : 0;
    return total + 1 + nested;
  }, 0);

/** Longest cumulative hop chain anywhere in the query (root tree + every projection path), counting
 *  hops nested inside `PathStep.filter` scoped conditions - mirrors `entityQueryIRValidator`'s
 *  `MAX_PATH_HOPS` accounting so the builder can flag an over-budget path inline before `parseText`
 *  or execution rejects it. */
export const countHops = (query: EntityQuery): number => {
  const rootHops = countNodeHops(query.root);
  const projectionHops = (query.projections ?? []).reduce(
    (max, projection) => Math.max(max, countPathHops(projection.path)),
    0
  );
  return Math.max(rootHops, projectionHops);
};

export const exceedsHopBudget = (query: EntityQuery): boolean => countHops(query) > MAX_PATH_HOPS;

/** A hop the visual builder can edit in place: entity-to-entity kinds only. A same-instance scoped
 *  `[...]` filter is fine as long as its own subtree is visually editable (recursive). Relation-
 *  context kinds (endpoint / relationForward / relationBackward) keep the query in Advanced text
 *  mode. Declared as `function`s so the step ⇄ node mutual recursion can hoist. */
function stepIsVisuallyEditable(step: PathStep): boolean {
  return (
    (step.kind === 'forward' ||
      step.kind === 'backward' ||
      step.kind === 'typedRelation' ||
      step.kind === 'unboundTypedRelation') &&
    (!step.filter || nodeIsVisuallyEditable(step.filter))
  );
}

function nodeIsVisuallyEditable(node: QueryNode): boolean {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.children.every(nodeIsVisuallyEditable);
    case 'not':
      return nodeIsVisuallyEditable(node.child);
    case 'predicate':
      return node.path.every(stepIsVisuallyEditable);
    case 'relationExists':
      return node.path.length > 0 && node.path.every(stepIsVisuallyEditable);
    case 'freeText':
      return true;
    default:
      return true;
  }
}

/** True when every step of `path` is one the visual leaf editor can render (entity-to-entity hop
 *  kinds, with any scoped filter itself editable) - the leaf falls back to a read-only summary
 *  otherwise. */
export const isPathVisuallyEditable = (path: PathStep[]): boolean =>
  path.every(stepIsVisuallyEditable);

// --- Relation-rooted path/node legality (#3120) -----------------------------------------------
//
// A relation-rooted path can leave entity context (`relationBackward`, entity -> relation) and
// come back (`endpoint`/`relationForward`, relation -> entity) - unlike the entity-only
// `stepIsVisuallyEditable`/`nodeIsVisuallyEditable` above, legality here depends on *where* in the
// path a step sits, not just its kind. Mirrors `entityQueryIRResolution.ts`'s `kindAfterStep`
// closely enough to stay correct without importing server code.

type PathPositionKind = 'entity' | 'relation';

const kindAfterStep = (step: PathStep): PathPositionKind =>
  step.kind === 'relationBackward' ? 'relation' : 'entity';

const isRelationStepLegalAt = (step: PathStep, position: PathPositionKind): boolean =>
  position === 'relation'
    ? step.kind === 'endpoint' || step.kind === 'relationForward'
    : step.kind === 'forward' ||
      step.kind === 'backward' ||
      step.kind === 'typedRelation' ||
      step.kind === 'unboundTypedRelation' ||
      step.kind === 'relationBackward';

const isPositionedPathVisuallyEditable = (
  path: PathStep[],
  rootPosition: PathPositionKind
): boolean => {
  let position = rootPosition;
  for (const step of path) {
    if (!isRelationStepLegalAt(step, position)) return false;
    if ('filter' in step && step.filter) {
      // Scoped `[...]` filters on a relation-context hop (`endpoint` has no `filter` at all - see
      // entityQueryIR.ts - so only `relationForward`/`relationBackward` reach here) aren't visually
      // editable yet (#3120) - treat any present filter there as unrepresentable rather than
      // rendering an editor for it. Entity-to-entity steps keep the existing recursive check.
      if (step.kind === 'relationForward' || step.kind === 'relationBackward') return false;
      if (!positionedNodeIsVisuallyEditable(step.filter, kindAfterStep(step))) return false;
    }
    position = kindAfterStep(step);
  }
  return true;
};

function positionedNodeIsVisuallyEditable(node: QueryNode, position: PathPositionKind): boolean {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.children.every(child => positionedNodeIsVisuallyEditable(child, position));
    case 'not':
      return positionedNodeIsVisuallyEditable(node.child, position);
    case 'predicate':
      return isPositionedPathVisuallyEditable(node.path, position);
    case 'relationExists':
      return node.path.length > 0 && isPositionedPathVisuallyEditable(node.path, position);
    // freeText is root-entity-search only (entityQueryIR.ts) - never valid mid-path or at a
    // relation position.
    case 'freeText':
      return position === 'entity';
    default:
      return true;
  }
}

/** True when every step of a relation-rooted `path` is one the visual leaf editor can render
 *  (relation's own field / `endpoint` / `relationForward` / `relationBackward`, in legal sequence,
 *  with any scoped filter itself editable) - the leaf falls back to a read-only summary
 *  otherwise. */
export const isRelationPathVisuallyEditable = (path: PathStep[]): boolean =>
  isPositionedPathVisuallyEditable(path, 'relation');

/** A relation-rooted node the relation builder can edit: a boolean tree of predicates/`relationExists`
 *  whose paths are `isRelationPathVisuallyEditable`. */
const relationNodeIsVisuallyEditable = (node: QueryNode): boolean =>
  positionedNodeIsVisuallyEditable(node, 'relation');

const relationProjectionIsVisuallyEditable = (projection: ProjectionField): boolean =>
  projection.source !== 'relation' && isRelationPathVisuallyEditable(projection.path);

/** True when every node in `query` is one the visual builder can currently edit in place. An
 *  entity query qualifies with a boolean tree of `path: []` / relation-traversal predicates plus
 *  free-text; a relation query qualifies with relation-field / `endpoint`/`relationForward`/
 *  `relationBackward` predicates. A `source: 'relation'` projection, or a shape a later phase still
 *  owns, is still *displayed* by the builder (read-only summaries) but the wiring layer keeps the
 *  whole query in Advanced text mode. */
export const isVisuallyEditable = (query: EntityQuery): boolean => {
  if ((query.root_kind ?? 'entity') === 'relation') {
    const projectionsEditable = (query.projections ?? []).every(
      relationProjectionIsVisuallyEditable
    );
    return projectionsEditable && relationNodeIsVisuallyEditable(query.root);
  }
  const projectionsEditable = (query.projections ?? []).every(
    projection => projection.source !== 'relation' && isPathVisuallyEditable(projection.path)
  );
  return projectionsEditable && nodeIsVisuallyEditable(query.root);
};

const countNodeConditions = (node: QueryNode): number => {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.children.reduce((sum, child) => sum + countNodeConditions(child), 0);
    case 'not':
      return countNodeConditions(node.child);
    case 'freeText':
      return 0;
    default:
      return 1;
  }
};

/** Number of leaf conditions (predicates + `relationExists`, excluding the free-text clause) in
 *  the query tree - drives the filter-button count badge. */
export const countConditions = (query: EntityQuery): number => countNodeConditions(query.root);

export { MAX_PATH_HOPS };

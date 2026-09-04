import { useCallback, useMemo } from 'react';
import type {
  EntityRecord,
  EntityRelation,
  TreeEdge,
  TreeNode
} from '@arch-register/api-types/entityContract';
import type { EntityQuery, PathStep } from '@arch-register/api-types/entityQueryIR';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntityRelationData } from '../../../hooks/useEntities';
import {
  buildContainmentTreeIndex,
  getContainmentChildren,
  getMapRoots,
  type ContainmentTreeIndex
} from './mapViewState';
import {
  addIncludePathProjection,
  decodeIncludePathProjection,
  type IncludedPath
} from './pathBuilder/pathBuilderState';
import type { MapConfig } from './mapViewConfig';

export const nodeName = (node: TreeNode) => node._name ?? node._slug;

export type RelationMapNode = TreeNode & { _mapRelation: EntityRelation };

export const isRelationMapNode = (node: TreeNode): node is RelationMapNode =>
  '_mapRelation' in node;

export const getMapEntityId = (node: TreeNode): string =>
  isRelationMapNode(node) ? node._mapRelation.entityId : node._publicId;

export const makeRelationMapNode = (
  relation: EntityRelation,
  relationSchema: RelationSchema
): RelationMapNode =>
  ({
    ...relation.relationFields,
    _uid: `relation:${relation.relationId}`,
    _publicId: relation.relationId,
    _schema: { id: relationSchema.id, name: relationSchema.name },
    _name: `${relation.fieldName}: ${relation.entityName}`,
    _slug: relation.relationId,
    _namespace: '',
    _description: '',
    _owner: null,
    _lifecycle: null,
    _targetLifecycle: null,
    _targetLifecycleDate: null,
    _tags: [],
    _links: [],
    _isMatch: true,
    _mapRelation: relation
  }) as unknown as RelationMapNode;

export type RenderTreeNode = {
  node: TreeNode;
  levelIndex: number;
  children: RenderTreeNode[];
};

export const MAP_INCLUDE_PATH_PROJECTION_ALIAS = '__map__:path';

/** Adds a single correlated `includePath: true` projection for `hopPath` (the resolved
 *  `PathStep`s connecting levels 1..N) onto `entityQuery`'s root scope, mirroring
 *  `buildTraceabilityEntityQuery`. An empty `hopPath` (a single-level map) adds no projection -
 *  `includePath: true` requires a non-empty path. */
export const buildIncludePathMapQuery = (
  entityQuery: EntityQuery | null | undefined,
  hopPath: PathStep[]
): { query: EntityQuery; alias: string } => ({
  query: addIncludePathProjection(entityQuery, hopPath, MAP_INCLUDE_PATH_PROJECTION_ALIAS),
  alias: MAP_INCLUDE_PATH_PROJECTION_ALIAS
});

export const toTreeNode = (entity: EntityRecord): TreeNode =>
  ({ ...entity, _isMatch: true }) as TreeNode;

/** Decodes every root's included-path projection value into `{ rootId -> IncludedPath[] }`, ready
 *  for `buildTreeFromIncludedPaths`/`collectIncludedPathNodeIds`. */
export const decodeMapIncludedPathsByRoot = (
  roots: Array<{ _uid: string; _projections?: Record<string, unknown> }>
): Map<string, IncludedPath[]> =>
  new Map(
    roots.map(root => [
      root._uid,
      decodeIncludePathProjection(root._projections?.[MAP_INCLUDE_PATH_PROJECTION_ALIAS])
    ])
  );

/** Every id referenced anywhere in `includedPathsByRootId`'s paths - the set of entities that need
 *  hydrating (via a batch id fetch) into full records before a render tree can be built, since an
 *  included-path projection only carries `{id, name, schemaId}` per hop. */
export const collectIncludedPathNodeIds = (
  includedPathsByRootId: Map<string, IncludedPath[]>
): string[] => [
  ...new Set(
    [...includedPathsByRootId.values()].flatMap(paths =>
      paths.flatMap(path => path.map(node => node.id))
    )
  )
];

/** Builds the map's render tree directly from correlated relation paths, replacing the
 *  client-side containment-only reassembly (`buildMapChildren`/`getContainmentChildren`) for maps
 *  whose whole level path is expressible as `PathStep`s (see `MapView.tsx`'s
 *  `useIncludePathTraversal`). Path nodes sharing a prefix (e.g. the same System reached via two
 *  different Component paths under one Domain) are merged into a single tree node rather than
 *  duplicated, by matching on id at each depth. `hydrate` resolves a path node's id to its full
 *  entity record (from a batch id fetch); a node that fails to hydrate (e.g. became inaccessible
 *  between the path query and the hydrate fetch) is dropped along with its descendants rather than
 *  rendered incomplete. */
export const buildTreeFromIncludedPaths = (
  roots: EntityRecord[],
  includedPathsByRootId: Map<string, IncludedPath[]>,
  hydrate: (id: string) => EntityRecord | undefined
): RenderTreeNode[] => {
  const sortByName = (nodes: RenderTreeNode[]) =>
    nodes.sort((a, b) => nodeName(a.node).localeCompare(nodeName(b.node)));

  const tree = roots.map(root => {
    const rootNode: RenderTreeNode = { node: toTreeNode(root), levelIndex: 0, children: [] };
    // Tracks each tree node's children-by-path-id lookup, so paths sharing a prefix (the same
    // System reached via two different Component paths) merge onto the same node instead of
    // duplicating it.
    const childrenById = new WeakMap<RenderTreeNode, Map<string, RenderTreeNode>>();
    childrenById.set(rootNode, new Map());

    for (const includedPath of includedPathsByRootId.get(root._uid) ?? []) {
      let parent = rootNode;
      for (let depth = 0; depth < includedPath.length; depth += 1) {
        const pathNode = includedPath[depth]!;
        const parentChildren = childrenById.get(parent)!;
        let entry = parentChildren.get(pathNode.id);
        if (!entry) {
          const hydrated = hydrate(pathNode.id);
          if (!hydrated) break;
          entry = { node: toTreeNode(hydrated), levelIndex: depth + 1, children: [] };
          parent.children.push(entry);
          parentChildren.set(pathNode.id, entry);
          childrenById.set(entry, new Map());
        }
        parent = entry;
      }
    }
    return rootNode;
  });

  const sortRecursive = (node: RenderTreeNode) => {
    sortByName(node.children);
    node.children.forEach(sortRecursive);
  };
  tree.forEach(sortRecursive);
  return sortByName(tree);
};

export const buildRelationMapChildren = (
  parentUid: string,
  relationSchemaId: string,
  relationSchemas: RelationSchema[],
  entityRelations: Map<string, EntityRelationData>,
  treeIndex: ContainmentTreeIndex
): RelationMapNode[] => {
  const relationSchema = relationSchemas.find(schema => schema.id === relationSchemaId);
  if (!relationSchema) return [];
  const relationData = entityRelations.get(parentUid);
  const unique = new Map<string, RelationMapNode>();
  for (const relation of [...(relationData?.outgoing ?? []), ...(relationData?.incoming ?? [])]) {
    if (relation.kind !== 'typed' || relation.relationSchemaId !== relationSchemaId) continue;
    if (!relation.relationId || !treeIndex.nodeMap.has(relation.entityId)) continue;
    unique.set(relation.relationId, makeRelationMapNode(relation, relationSchema));
  }
  return [...unique.values()].sort((a, b) => nodeName(a).localeCompare(nodeName(b)));
};

export const buildMapChildren = (
  parentUid: string,
  schemaId: string | null,
  treeIndex: ContainmentTreeIndex,
  entityRelations: Map<string, EntityRelationData>
): TreeNode[] => {
  if (!schemaId) return [];
  const containmentChildren = getContainmentChildren(parentUid, schemaId, treeIndex);
  const relationData = entityRelations.get(parentUid);
  const relatedIds = [...(relationData?.outgoing ?? []), ...(relationData?.incoming ?? [])]
    .filter(relation => relation.kind === 'typed' && relation.entitySchemaId === schemaId)
    .map(relation => relation.entityId);
  const relatedChildren = relatedIds
    .map(id => treeIndex.nodeMap.get(id))
    .filter((node): node is TreeNode => node != null);
  const unique = new Map<string, TreeNode>();
  for (const node of [...containmentChildren, ...relatedChildren]) unique.set(node._uid, node);
  return [...unique.values()].sort((a, b) => nodeName(a).localeCompare(nodeName(b)));
};

type UseMapTraversalArgs = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  relationSchemas: RelationSchema[];
  entityRelations: Map<string, EntityRelationData>;
  cfg: MapConfig;
};

export const useMapTraversal = ({
  nodes,
  edges,
  relationSchemas,
  entityRelations,
  cfg
}: UseMapTraversalArgs) => {
  const treeIndex = useMemo(() => buildContainmentTreeIndex(nodes, edges), [nodes, edges]);

  const getRelationMapChildren = useCallback(
    (parentUid: string, relationSchemaId: string): RelationMapNode[] => {
      return buildRelationMapChildren(
        parentUid,
        relationSchemaId,
        relationSchemas,
        entityRelations,
        treeIndex
      );
    },
    [entityRelations, relationSchemas, treeIndex]
  );

  const getMapChildren = useCallback(
    (parentUid: string, schemaId: string | null): TreeNode[] => {
      return buildMapChildren(parentUid, schemaId, treeIndex, entityRelations);
    },
    [entityRelations, treeIndex]
  );

  const level1SchemaId = cfg.levelConfigs[0]?.schemaId ?? null;
  const level1Items = useMemo(
    () => getMapRoots(nodes, edges, level1SchemaId),
    [edges, level1SchemaId, nodes]
  );

  const getMapChildrenForNode = useCallback(
    (parent: TreeNode, schemaId: string | null): TreeNode[] => {
      if (!schemaId) return [];
      if (isRelationMapNode(parent)) {
        const endpoint = treeIndex.nodeMap.get(parent._mapRelation.entityId);
        if (endpoint?._schema.id === schemaId) return [endpoint];
      }
      const parentUid = isRelationMapNode(parent) ? parent._mapRelation.entityId : parent._uid;
      if (relationSchemas.some(schema => schema.id === schemaId)) {
        return getRelationMapChildren(parentUid, schemaId);
      }
      return getMapChildren(parentUid, schemaId);
    },
    [getMapChildren, getRelationMapChildren, relationSchemas, treeIndex]
  );

  const renderTree = useMemo(() => {
    const build = (node: TreeNode, levelIndex: number): RenderTreeNode => ({
      node,
      levelIndex,
      children:
        levelIndex + 1 < cfg.levelConfigs.length
          ? getMapChildrenForNode(node, cfg.levelConfigs[levelIndex + 1]?.schemaId ?? null).map(
              child => build(child, levelIndex + 1)
            )
          : []
    });
    return level1Items.map(node => build(node, 0));
  }, [cfg.levelConfigs, getMapChildrenForNode, level1Items]);

  return {
    treeIndex: treeIndex as ContainmentTreeIndex,
    level1Items,
    renderTree
  };
};

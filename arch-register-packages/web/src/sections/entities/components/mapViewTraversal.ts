import { useCallback, useMemo } from 'react';
import type { EntityRelation, TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntityRelationData } from '../../../hooks/useEntities';
import {
  buildContainmentTreeIndex,
  getContainmentChildren,
  sortContainmentNodes,
  type ContainmentTreeIndex
} from './mapViewState';
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
    if (!relation.relationId || !treeIndex.nodeMap.get(relation.entityId)?._isMatch) continue;
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
    .filter((node): node is TreeNode => node?._isMatch === true);
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
    () => sortContainmentNodes(nodes, level1SchemaId),
    [nodes, level1SchemaId]
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

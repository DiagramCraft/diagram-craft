import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';

export type ContainmentTreeIndex = {
  nodeMap: Map<string, TreeNode>;
  childrenOf: Map<string, string[]>;
};

export const getChildSchemas = (
  schemas: EntitySchema[],
  parentSchemaId: string | null
): EntitySchema[] => {
  if (!parentSchemaId) return schemas;
  return schemas.filter(schema =>
    schema.fields.some(field => field.type === 'containment' && field.schemaId === parentSchemaId)
  );
};

export const buildContainmentTreeIndex = (
  nodes: TreeNode[],
  edges: TreeEdge[]
): ContainmentTreeIndex => {
  const nodeMap = new Map<string, TreeNode>();
  for (const node of nodes) nodeMap.set(node._uid, node);

  const childrenOf = new Map<string, string[]>();
  for (const { childId, parentId } of edges) {
    const children = childrenOf.get(parentId) ?? [];
    children.push(childId);
    childrenOf.set(parentId, children);
  }
  return { nodeMap, childrenOf };
};

const nodeName = (node: TreeNode) => node._name || node._slug;

export const sortContainmentNodes = (nodes: TreeNode[], schemaId: string | null): TreeNode[] =>
  nodes
    .filter(node => node._schema.id === schemaId && node._isMatch)
    .sort((a, b) => nodeName(a).localeCompare(nodeName(b)));

export const getContainmentChildren = (
  parentUid: string,
  schemaId: string | null,
  index: ContainmentTreeIndex
): TreeNode[] => {
  if (!schemaId) return [];
  return sortContainmentNodes(
    (index.childrenOf.get(parentUid) ?? [])
      .map(id => index.nodeMap.get(id))
      .filter((node): node is TreeNode => !!node),
    schemaId
  );
};

import { DiagramEdge, DiagramNode } from './diagram.ts';

export const NodeHelper = {
  edges: (node: DiagramNode): DiagramEdge[] => {
    return [
      ...Object.values(node.edges ?? {}).flatMap(e => e),
      ...node.children.flatMap(c => NodeHelper.edges(c))
    ];
  },
  cloneNodeBounds: (node: DiagramNode): DiagramNode => {
    return {
      ...node,
      bounds: {
        pos: { ...node.bounds.pos },
        size: { ...node.bounds.size },
        rotation: node.bounds.rotation
      },
      children: node.children.map(c => NodeHelper.cloneNodeBounds(c))
    };
  }
};

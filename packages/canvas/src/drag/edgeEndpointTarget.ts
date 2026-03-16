import { Point } from '@diagram-craft/geometry/point';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

const nodeContainsPoint = (node: DiagramNode, point: Point) => {
  const def = node.getDefinition();
  const path = def.getHitArea(node) ?? def.getBoundingPath(node);

  return path.isInside(point) || path.isOn(point, 5);
};

const findDeepestNodeAtPoint = (node: DiagramNode, point: Point): DiagramNode | undefined => {
  if (!nodeContainsPoint(node, point)) return undefined;

  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i];
    if (!child || !isNode(child)) continue;

    const deepestChild = findDeepestNodeAtPoint(child, point);
    if (deepestChild) return deepestChild;
  }

  return node;
};

export const resolveEdgeEndpointTarget = (element: DiagramElement, point: Point): DiagramElement => {
  if (!isNode(element)) return element;
  return findDeepestNodeAtPoint(element, point) ?? element;
};

import { LayoutNode } from '@diagram-craft/canvas/layout/layoutTree';
import { clamp } from '@diagram-craft/utils/math';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UMLClassNodeDefinition } from '@diagram-craft/stencil-uml/class/UMLClass.nodeType';
import { mustExist } from '@diagram-craft/utils/assert';

const isUMLPortNode = (e: DiagramElement) => isNode(e) && e.nodeType === 'umlPort';
const isPortHost = (n: DiagramNode) => n.getDefinition() instanceof UMLClassNodeDefinition;

export const classifyPortChildren = (node: DiagramNode) => {
  const ports: DiagramNode[] = [];
  const regularChildren: DiagramNode[] = [];

  for (const child of node.children) {
    if (!isNode(child)) continue;

    if (isUMLPortNode(child)) {
      ports.push(child);
    } else {
      regularChildren.push(child);
    }
  }

  return { ports, regularChildren };
};

const findChildLayout = (layoutNode: LayoutNode, childId: string) =>
  mustExist(layoutNode.children.find(c => c.id === childId));

const snapPortToBorder = (portLayout: LayoutNode, hostLayout: LayoutNode) => {
  const centerX = portLayout.bounds.x + portLayout.bounds.w / 2;
  const centerY = portLayout.bounds.y + portLayout.bounds.h / 2;

  // Preserve the user's intended side by snapping to the nearest host edge.
  const distances = [
    { edge: 'left', distance: Math.abs(centerX) },
    { edge: 'right', distance: Math.abs(hostLayout.bounds.w - centerX) },
    { edge: 'top', distance: Math.abs(centerY) },
    { edge: 'bottom', distance: Math.abs(hostLayout.bounds.h - centerY) }
  ] as const;

  const nearest = distances.reduce((best, current) =>
    current.distance < best.distance ? current : best
  );

  if (nearest.edge === 'left' || nearest.edge === 'right') {
    portLayout.bounds.y = clamp(portLayout.bounds.y, 0, hostLayout.bounds.h - portLayout.bounds.h);
    portLayout.bounds.x =
      nearest.edge === 'left'
        ? -portLayout.bounds.w / 2
        : hostLayout.bounds.w - portLayout.bounds.w / 2;
    return;
  }

  portLayout.bounds.x = clamp(portLayout.bounds.x, 0, hostLayout.bounds.w - portLayout.bounds.w);
  portLayout.bounds.y =
    nearest.edge === 'top'
      ? -portLayout.bounds.h / 2
      : hostLayout.bounds.h - portLayout.bounds.h / 2;
};

export const preparePortLayoutTree = (node: DiagramNode, layoutNode: LayoutNode) => {
  if (isPortHost(node)) {
    // Ports should keep their dragged position until we snap them to the host border,
    // so exclude them from the container's normal child flow layout.
    for (const child of node.children) {
      if (!isUMLPortNode(child)) continue;

      const childLayout = findChildLayout(layoutNode, child.id);
      childLayout.elementInstructions = {
        ...childLayout.elementInstructions,
        isAbsolute: true
      };
    }
  }

  for (const child of node.children.filter(isNode)) {
    preparePortLayoutTree(child, findChildLayout(layoutNode, child.id));
  }
};

export const snapPortsInLayoutTree = (node: DiagramNode, layoutNode: LayoutNode) => {
  if (isPortHost(node)) {
    // Snap after generic layout so auto-sized hosts use their final bounds.
    for (const child of node.children) {
      if (!isUMLPortNode(child)) continue;

      snapPortToBorder(findChildLayout(layoutNode, child.id), layoutNode);
    }
  }

  for (const child of node.children.filter(isNode)) {
    snapPortsInLayoutTree(child, findChildLayout(layoutNode, child.id));
  }
};

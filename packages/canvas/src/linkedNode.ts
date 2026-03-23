import { Direction } from '@diagram-craft/geometry/direction';
import { assert } from '@diagram-craft/utils/assert';
import { Anchor } from '@diagram-craft/model/anchor';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { AnchorEndpoint, PointInNodeEndpoint } from '@diagram-craft/model/endpoint';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { Box } from '@diagram-craft/geometry/box';
import type { EdgeProps } from '@diagram-craft/model/diagramProps';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';

const OFFSET = 100;
const SECONDARY_OFFSET = 20;

export const createLinkedNode = (node: DiagramNode, anchor: string, direction: Direction) =>
  createLinkedNodeFromSource(
    node,
    { point: node._getAnchorPosition(anchor), endpoint: () => new AnchorEndpoint(node, anchor) },
    direction
  );

export const createLinkedNodeFromSource = (
  node: DiagramNode,
  source: { point: Point; endpoint: () => AnchorEndpoint | PointInNodeEndpoint },
  direction: Direction
) => {
  const diagram = node.diagram;

  return UnitOfWork.executeWithUndo(diagram, 'Link to new node', uow => {
    const activeLayer = diagram.activeLayer;
    const nodeLayer = node.diagram.activeLayer;

    assertRegularLayer(activeLayer);
    assertRegularLayer(nodeLayer);

    const newNode = node.duplicate();
    nodeLayer.addElement(newNode, uow);

    if (direction === 'w') {
      newNode.transform([new Translation({ x: -(OFFSET + node.bounds.w), y: 0 })], uow);
    } else if (direction === 'e') {
      newNode.transform([new Translation({ x: OFFSET + node.bounds.w, y: 0 })], uow);
    } else if (direction === 'n') {
      newNode.transform([new Translation({ x: 0, y: -(OFFSET + node.bounds.h) })], uow);
    } else {
      newNode.transform([new Translation({ x: 0, y: OFFSET + node.bounds.h })], uow);
    }

    // We need to determine the correct anchor before we adjust along the secondary axis
    // ... as we want when creating multiple nodes that all connect to the "same" anchor
    let distance = Number.MAX_SAFE_INTEGER;
    let shortest: Anchor | undefined;
    for (const anchor of newNode.anchors) {
      const d = Point.distance(source.point, newNode._getAnchorPosition(anchor.id));
      if (d < distance) {
        distance = d;
        shortest = anchor;
      }
    }
    assert.present(shortest, 'Could not find shortest anchor');

    const extent = direction === 'w' || direction === 'e' ? 'h' : 'w';
    const coord = direction === 'w' || direction === 'e' ? 'y' : 'x';

    const origBounds = newNode.bounds;

    // Move "right"
    let secondaryOffset = 0;
    do {
      const intersectingNode = activeLayer.elements.find(
        e => e !== newNode && Box.intersects(e.bounds, newNode.bounds)
      );
      if (!intersectingNode) break;

      secondaryOffset += intersectingNode.bounds[extent] + SECONDARY_OFFSET;

      newNode.setBounds(
        {
          ...newNode.bounds,
          [coord]: origBounds[coord] + secondaryOffset
        },
        uow
      );
    } while (true);

    const rightSecondaryOffset = secondaryOffset;
    const rightBounds = newNode.bounds;

    // Move "left"
    newNode.setBounds(origBounds, uow);
    secondaryOffset = 0;
    do {
      const intersectingNode = activeLayer.elements.find(
        e => e !== newNode && Box.intersects(e.bounds, newNode.bounds)
      );
      if (!intersectingNode) break;

      secondaryOffset -= intersectingNode.bounds[extent] + SECONDARY_OFFSET;

      newNode.setBounds(
        {
          ...newNode.bounds,
          [coord]: origBounds[coord] + secondaryOffset
        },
        uow
      );
    } while (true);

    // Keep the best direction
    if (Math.abs(rightSecondaryOffset) < Math.abs(secondaryOffset)) {
      newNode.setBounds(rightBounds, uow);
    }

    // In case the stylesheet doesn't include an end arrow, we add
    // a default one
    const styles = diagram.document.styles.activeEdgeStylesheet.props;
    const additionalStyles: Partial<EdgeProps> = {};
    if (!styles.arrow?.end?.type) {
      additionalStyles.arrow = { end: { type: 'SQUARE_STICK_ARROW' } };
    }

    const edge = ElementFactory.edge({
      start: source.endpoint(),
      end: new AnchorEndpoint(newNode, shortest.id),
      props: additionalStyles,
      metadata: {
        style: diagram.document.styles.activeEdgeStylesheet.id
      },
      layer: node.layer
    });

    nodeLayer.addElement(edge, uow);

    uow.select(diagram, [newNode]);

    return newNode;
  });
};

// Creates a temporary linked duplicate at a specific drop point so the popup can
// either keep it, change its shape, or remove it and leave only the edge.
export const createProvisionalLinkedNode = (
  sourceNode: DiagramNode,
  edge: DiagramEdge,
  position: Point
) => {
  const diagram = sourceNode.diagram;

  return UnitOfWork.executeWithUndo(diagram, 'Link to new node', uow => {
    const layer = sourceNode.layer;
    assertRegularLayer(layer);

    const newNode = sourceNode.duplicate();
    layer.addElement(newNode, uow);

    const targetX = position.x - newNode.bounds.w / 2;
    const targetY = position.y - newNode.bounds.h / 2;
    const dx = targetX - newNode.bounds.x;
    const dy = targetY - newNode.bounds.y;
    newNode.transform([new Translation({ x: dx, y: dy })], uow);

    edge.setEnd(new AnchorEndpoint(newNode, 'c'), uow);
    uow.select(diagram, [newNode]);

    return newNode;
  });
};

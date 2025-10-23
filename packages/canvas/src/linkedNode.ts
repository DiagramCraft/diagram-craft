import { Direction } from '@diagram-craft/geometry/direction';
import { assert } from '@diagram-craft/utils/assert';
import { Anchor } from '@diagram-craft/model/anchor';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import { newid } from '@diagram-craft/utils/id';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { createResizeCanvasActionToFit } from '@diagram-craft/model/helpers/canvasResizeHelper';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { Box } from '@diagram-craft/geometry/box';

const OFFSET = 100;
const SECONDARY_OFFSET = 20;

export const createLinkedNode = (
  node: DiagramNode,
  sourceAnchorId: string,
  direction: Direction
) => {
  const diagram = node.diagram;
  assertRegularLayer(diagram.activeLayer);
  assertRegularLayer(node.diagram.activeLayer);

  const uow = new UnitOfWork(diagram);
  const newNode = node.duplicate();

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
    const d = Point.distance(
      node._getAnchorPosition(sourceAnchorId),
      newNode._getAnchorPosition(anchor.id)
    );
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
    const intersectingNode = diagram.activeLayer.elements.find(e =>
      Box.intersects(e.bounds, newNode.bounds)
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
    const intersectingNode = diagram.activeLayer.elements.find(e =>
      Box.intersects(e.bounds, newNode.bounds)
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

  const edge = ElementFactory.edge(
    newid(),
    new AnchorEndpoint(node, sourceAnchorId),
    new AnchorEndpoint(newNode, shortest.id),
    additionalStyles,
    {
      style: diagram.document.styles.activeEdgeStylesheet.id
    },
    [],
    node.layer
  );

  const resizeAction = createResizeCanvasActionToFit(node.diagram, newNode.bounds);
  node.diagram.undoManager.addAndExecute(
    new CompoundUndoableAction([
      new ElementAddUndoableAction(
        [newNode, edge],
        node.diagram,
        node.diagram.activeLayer,
        'Link to new node'
      ),
      ...(resizeAction ? [resizeAction] : [])
    ])
  );
  uow.commit();

  return newNode;
};

import { AbstractDrag, Modifiers } from '../dragDropManager';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { EdgeEndpointMoveDrag } from './edgeEndpointMoveDrag';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { ApplicationTriggers } from '../EditableCanvasComponent';
import { newid } from '@diagram-craft/utils/id';
import { AnchorEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { Translation } from '@diagram-craft/geometry/transform';
import { Direction } from '@diagram-craft/geometry/direction';
import { Anchor } from '@diagram-craft/model/anchor';
import { assert } from '@diagram-craft/utils/assert';
import { Box } from '@diagram-craft/geometry/box';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { createResizeCanvasActionToFit } from '@diagram-craft/model/helpers/canvasResizeHelper';

const OFFSET = 100;
const SECONDARY_OFFSET = 20;

const linkToNewNode = (node: DiagramNode, sourceAnchorId: string, direction: Direction) => {
  const diagram = node.diagram;

  const uow = new UnitOfWork(diagram, false, false);
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
  let shortest: Anchor | undefined = undefined;
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
    const intersectingNode = diagram.layers.active.elements.find(e =>
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

    // eslint-disable-next-line no-constant-condition
  } while (true);

  const rightSecondaryOffset = secondaryOffset;
  const rightBounds = newNode.bounds;

  // Move "left"
  newNode.setBounds(origBounds, uow);
  secondaryOffset = 0;
  do {
    const intersectingNode = diagram.layers.active.elements.find(e =>
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

    // eslint-disable-next-line no-constant-condition
  } while (true);

  // Keep the best direction
  if (Math.abs(rightSecondaryOffset) < Math.abs(secondaryOffset)) {
    newNode.setBounds(rightBounds, uow);
  }

  const edge = new DiagramEdge(
    newid(),
    new AnchorEndpoint(node, sourceAnchorId),
    new AnchorEndpoint(newNode, shortest.id),
    {
      type: 'orthogonal',
      arrow: {
        end: {
          type: 'SQUARE_STICK_ARROW'
        }
      },
      routing: {
        rounding: 10
      }
    },
    [],
    node.diagram,
    node.layer
  );

  const resizeAction = createResizeCanvasActionToFit(node.diagram, newNode.bounds);
  node.diagram.undoManager.addAndExecute(
    new CompoundUndoableAction([
      new ElementAddUndoableAction([newNode, edge], node.diagram, 'Link to new node'),
      ...(resizeAction ? [resizeAction] : [])
    ])
  );
  uow.commit();
};

export class AnchorHandleDrag extends AbstractDrag {
  edge: DiagramEdge;
  private delegate: EdgeEndpointMoveDrag;

  constructor(
    private readonly node: DiagramNode,
    private readonly anchorId: string,
    private readonly point: Point,
    private readonly applicationTriggers: ApplicationTriggers
  ) {
    super();

    const diagram = this.node.diagram;

    this.edge = new DiagramEdge(
      newid(),
      new AnchorEndpoint(this.node, this.anchorId),
      new FreeEndpoint(diagram.viewBox.toDiagramPoint(this.point)),
      {},
      [],
      diagram,
      diagram.layers.active
    );

    diagram.undoManager.setMark();

    const uow = new UnitOfWork(diagram);
    diagram.layers.active.addElement(this.edge, uow);

    uow.updateElement(this.node);
    uow.commit();

    diagram.selectionState.setElements([this.edge]);

    // TODO: This is the wrong this.element to use
    this.delegate = new EdgeEndpointMoveDrag(diagram, this.edge, 'end', applicationTriggers);
  }

  onDragEnd() {
    const diagram = this.node.diagram;

    const isShortDrag =
      this.delegate.point === undefined ||
      Point.distance(this.delegate.point!, diagram.viewBox.toDiagramPoint(this.point)) < 5;

    if (isShortDrag) {
      // Undo work to drag new edge
      this.delegate.cancel();
      UnitOfWork.execute(this.node.diagram, uow => {
        this.edge.layer.removeElement(this.edge, uow);
        this.edge.detach(uow);
      });
      diagram.selectionState.setElements([]);

      // Clone node and move to the right
      linkToNewNode(
        this.node,
        this.anchorId,
        Direction.fromAngle(this.node.getAnchor(this.anchorId).normal ?? 0, true)
      );

      return;
    }

    this.node.diagram.undoManager.add(new ElementAddUndoableAction([this.edge], this.node.diagram));

    // TODO: Need to prevent undoable action from being added twice
    this.delegate.onDragEnd();

    // In case we have connected to an existing node, we don't need to show the popup
    if (this.edge.end.isConnected) return;

    this.applicationTriggers.showNodeLinkPopup?.(
      this.edge.end.position,
      this.node!.id,
      this.edge.id
    );
  }

  onDrag(coord: Point, _modifiers: Modifiers): void {
    this.delegate.onDrag(coord, _modifiers);
  }

  onDragEnter(id: string) {
    this.delegate.onDragEnter(id);
  }

  onDragLeave() {
    this.delegate.onDragLeave();
  }
}

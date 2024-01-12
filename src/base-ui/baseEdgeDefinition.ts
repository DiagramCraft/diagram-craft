import { EdgeCapability, EdgeDefinition } from '../model/elementDefinitionRegistry.ts';
import { Point } from '../geometry/point.ts';
import { DiagramElement, isNode } from '../model/diagramElement.ts';
import { UnitOfWork } from '../model/unitOfWork.ts';
import { UndoableAction } from '../model/undoManager.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { newid } from '../utils/id.ts';
import { deepClone } from '../utils/clone.ts';
import { LengthOffsetOnPath } from '../geometry/pathPosition.ts';
import { ConnectedEndpoint, DiagramEdge } from '../model/diagramEdge.ts';

export class BaseEdgeDefinition implements EdgeDefinition {
  public readonly id: string;
  public readonly name: string;
  public readonly type: string;

  constructor(id: string, name: string, type: string) {
    this.id = id;
    this.name = name;
    this.type = type;
  }

  supports(_capability: EdgeCapability): boolean {
    return true;
  }

  onDrop(
    coord: Point,
    edge: DiagramEdge,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: string
  ): UndoableAction | undefined {
    if (elements.length !== 1 || !isNode(elements[0])) return undefined;

    if (operation === 'split') {
      return this.onDropSplit(edge, elements[0], uow);
    } else {
      return this.onDropAttachAsLabel(edge, elements[0], coord, uow);
    }
  }

  private onDropSplit(
    edge: DiagramEdge,
    element: DiagramNode,
    uow: UnitOfWork
  ): UndoableAction | undefined {
    // We will attach to the center point anchor
    const anchor = 0;

    // TODO: This requires some work to support dropping on multi-segment edges
    const newEdge = new DiagramEdge(
      newid(),
      new ConnectedEndpoint(anchor, element),
      edge.end,
      deepClone(edge.props) as EdgeProps,
      [],
      edge.diagram,
      edge.layer
    );
    edge.layer.addElement(newEdge, uow);

    edge.setEnd(new ConnectedEndpoint(anchor, element), uow);

    uow.updateElement(edge);

    // TODO: Support undo
    return undefined;
  }

  private onDropAttachAsLabel(
    edge: DiagramEdge,
    element: DiagramNode,
    coord: Point,
    uow: UnitOfWork
  ): UndoableAction | undefined {
    const path = edge.path();
    const projection = path.projectPoint(coord);

    edge.addLabelNode(
      {
        id: element.id,
        node: element,
        offset: Point.ORIGIN,
        timeOffset: LengthOffsetOnPath.toTimeOffsetOnPath(projection, path).pathT,
        type: 'horizontal'
      },
      uow
    );

    element.updateProps(props => (props.labelForEdgeId = this.id), uow);

    // TODO: Perhaps create a helper to add an element as a label edge
    // TODO: Maybe use detach here
    if (edge.parent) {
      if (element.parent) {
        element.parent.removeChild(element, uow);
      }

      edge.parent.addChild(element, uow);
    }

    uow.updateElement(element);
    uow.updateElement(edge);

    // TODO: Support undo
    return undefined;
  }
}

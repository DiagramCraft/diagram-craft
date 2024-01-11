import { EdgeCapability, EdgeDefinition } from '../model/elementDefinitionRegistry.ts';
import { Point } from '../geometry/point.ts';
import { DiagramElement, isNode } from '../model/diagramElement.ts';
import { UnitOfWork } from '../model/unitOfWork.ts';
import { UndoableAction } from '../model/undoManager.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { newid } from '../utils/id.ts';
import { deepClone } from '../utils/clone.ts';
import { LengthOffsetOnPath } from '../geometry/pathPosition.ts';
import { DiagramEdge } from '../model/diagramEdge.ts';

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
      { anchor, node: element },
      edge.end,
      deepClone(edge.props),
      [],
      edge.diagram,
      edge.layer
    );
    element.addEdge(anchor, newEdge);
    edge.layer.addElement(newEdge, uow);

    edge.end = { anchor: anchor, node: element };

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

    UnitOfWork.execute(edge.diagram, uow => {
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
    });

    element.props.labelForEdgeId = this.id;

    // TODO: Perhaps create a helper to add an element as a label edge
    if (edge.parent) {
      if (element.parent) {
        element.parent.children = element.parent.children.filter(c => c !== element);
        uow.updateElement(element.parent);
      }

      element.parent = edge.parent;
      edge.parent.children = [...edge.parent.children, element];
      uow.updateElement(edge.parent);
    }

    uow.updateElement(element);
    uow.updateElement(edge);

    // TODO: Support undo
    return undefined;
  }
}

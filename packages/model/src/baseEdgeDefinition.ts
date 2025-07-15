import { Point } from '@diagram-craft/geometry/point';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import {
  CustomPropertyDefinition,
  EdgeCapability,
  EdgeDefinition
} from './elementDefinitionRegistry';
import { DiagramEdge } from './diagramEdge';
import { DiagramElement, isNode } from './diagramElement';
import { UnitOfWork } from './unitOfWork';
import { DiagramNode } from './diagramNode';
import { AnchorEndpoint } from './endpoint';
import { newid } from '@diagram-craft/utils/id';
import { deepClone } from '@diagram-craft/utils/object';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { RegularLayer } from './diagramLayerRegular';
import { assertRegularLayer } from './diagramLayerUtils';

export class BaseEdgeDefinition implements EdgeDefinition {
  public readonly name: string;
  public readonly type: string;

  constructor(name: string, type: string) {
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
  ) {
    if (!(edge.layer instanceof RegularLayer)) return;
    if (elements.length !== 1 || !isNode(elements[0])) return;

    if (operation === 'split') {
      this.onDropSplit(edge, elements[0], uow);
    } else {
      this.onDropAttachAsLabel(edge, elements[0], coord, uow);
    }
  }

  private onDropSplit(edge: DiagramEdge, element: DiagramNode, uow: UnitOfWork) {
    // We will attach to the center point anchor
    const anchor = 'c';

    // TODO: This requires some work to support dropping on multi-segment edges
    const newEdge = DiagramEdge.create(
      newid(),
      new AnchorEndpoint(element, anchor),
      edge.end,
      deepClone(edge.editProps) as EdgeProps,
      edge.metadataCloned as ElementMetadata,
      [],
      edge.layer
    );
    assertRegularLayer(edge.layer);
    edge.layer.addElement(newEdge, uow);

    edge.setEnd(new AnchorEndpoint(element, anchor), uow);

    uow.updateElement(edge);
  }

  private onDropAttachAsLabel(
    edge: DiagramEdge,
    element: DiagramNode,
    coord: Point,
    uow: UnitOfWork
  ) {
    if (element.isLabelNode()) return;

    const path = edge.path();
    const projection = path.projectPoint(coord);

    edge.addLabelNode(
      {
        id: element.id,
        node: () => element,
        offset: Point.ORIGIN,
        timeOffset: LengthOffsetOnPath.toTimeOffsetOnPath(projection, path).pathT,
        type: 'horizontal'
      },
      uow
    );

    // TODO: Perhaps create a helper to add an element as a label edge
    // TODO: Maybe use detach here
    if (edge.parent) {
      if (element.parent) {
        if (isNode(element.parent)) {
          element.parent.removeChild(element, uow);
        } else {
          // This means that element.parent is an edge - implying
          // element is a label node - however, we've already covered
          // this case at the beginning of the function
          VERIFY_NOT_REACHED();
        }
      }

      edge.parent.addChild(element, uow);
    }

    uow.updateElement(element);
    uow.updateElement(edge);
  }

  getCustomPropertyDefinitions(_edge: DiagramEdge): Array<CustomPropertyDefinition> {
    return [];
  }
}

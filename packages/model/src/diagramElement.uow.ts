import {
  DiagramEdgeSnapshot,
  DiagramNodeSnapshot,
  UnitOfWork,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { EdgeProps } from '@diagram-craft/model/diagramProps';
import { Point } from '@diagram-craft/geometry/point';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

export class DiagramElementUOWSpecification implements UOWTrackableSpecification<
  DiagramNodeSnapshot | DiagramEdgeSnapshot,
  DiagramElement
> {
  onAfterCommit(_elements: Array<DiagramElement>, _uow: UnitOfWork): void {}

  onBeforeCommit(_elements: Array<DiagramElement>, _uow: UnitOfWork): void {}

  updateElement(
    diagram: Diagram,
    elementId: string,
    snapshot: DiagramNodeSnapshot | DiagramEdgeSnapshot,
    uow: UnitOfWork
  ): void {
    const element = mustExist(diagram.lookup(elementId));
    element.restore(snapshot, uow);
  }

  restore(
    snapshot: DiagramNodeSnapshot | DiagramEdgeSnapshot,
    element: DiagramElement,
    uow: UnitOfWork
  ): void {
    element.restore(snapshot, uow);
  }

  snapshot(element: DiagramElement): DiagramNodeSnapshot | DiagramEdgeSnapshot {
    return element.snapshot() as DiagramNodeSnapshot | DiagramEdgeSnapshot;
  }

  children(element: DiagramElement) {
    return element.children.map((c, idx) => ({ value: c, idx }));
  }
}

export class DiagramElementParentChildUOWSpecification implements UOWTrackableParentChildSpecification<
  DiagramNodeSnapshot | DiagramEdgeSnapshot
> {
  addElement(
    diagram: Diagram,
    parentId: string,
    _childId: string,
    childSnapshot: DiagramNodeSnapshot | DiagramEdgeSnapshot,
    _idx: number,
    uow: UnitOfWork
  ): void {
    const parent = mustExist(diagram.lookup(parentId));

    let child: DiagramElement;
    if (childSnapshot.type === 'node') {
      const node = ElementFactory.node(
        childSnapshot.id,
        childSnapshot.nodeType,
        childSnapshot.bounds,
        parent.layer,
        childSnapshot.props,
        childSnapshot.metadata,
        childSnapshot.texts
      );
      node.restore(childSnapshot, uow);
      child = node;
    } else if (childSnapshot.type === 'edge') {
      const edge = ElementFactory.edge(
        childSnapshot.id,
        new FreeEndpoint(Point.of(0, 0)),
        new FreeEndpoint(Point.of(0, 0)),
        childSnapshot.props as EdgeProps,
        childSnapshot.metadata,
        [],
        parent.layer
      );
      edge.restore(childSnapshot, uow);
      child = edge;
    } else {
      VERIFY_NOT_REACHED();
    }

    parent.addChild(child, uow);
  }

  removeElement(diagram: Diagram, parentId: string, childId: string, uow: UnitOfWork): void {
    const parent = mustExist(diagram.lookup(parentId));
    const child = mustExist(diagram.lookup(childId));
    parent.removeChild(child, uow);
  }
}

import {
  DiagramEdgeSnapshot,
  DiagramNodeSnapshot,
  UnitOfWork,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist } from '@diagram-craft/utils/assert';

export class DiagramElementUOWSpecification implements UOWTrackableSpecification<
  DiagramNodeSnapshot | DiagramEdgeSnapshot,
  DiagramElement
> {
  addElement(element: DiagramElement, child: DiagramElement, _idx: number, uow: UnitOfWork): void {
    if (isNode(element)) {
      // TODO: Support for idx
      element.addChild(child, uow);
    }
  }

  onAfterCommit(_elements: Array<DiagramElement>, _uow: UnitOfWork): void {}

  onBeforeCommit(_elements: Array<DiagramElement>, _uow: UnitOfWork): void {}

  removeElement(element: DiagramElement, child: DiagramElement, uow: UnitOfWork): void {
    if (isNode(element)) {
      element.removeChild(child, uow);
    }
  }

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

  children(_element: DiagramElement) {
    return [];
  }
}

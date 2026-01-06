import {
  StylesheetSnapshot,
  UnitOfWork,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import { Stylesheet } from '@diagram-craft/model/diagramStyles';
import { mustExist, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Diagram } from '@diagram-craft/model/diagram';

export class DiagramStylesUOWSpecification implements UOWTrackableSpecification<
  StylesheetSnapshot,
  Stylesheet<any>
> {
  addElement(_stylesheet: Stylesheet<any>, _child: any, _idx: number, _uow: UnitOfWork): void {
    VERIFY_NOT_REACHED();
  }

  onAfterCommit(_stylesheets: Array<Stylesheet<any>>, _uow: UnitOfWork): void {}

  onBeforeCommit(_stylesheets: Array<Stylesheet<any>>, _uow: UnitOfWork): void {}

  removeElement(_stylesheet: Stylesheet<any>, _child: any, _uow: UnitOfWork): void {
    VERIFY_NOT_REACHED();
  }

  updateElement(diagram: Diagram, id: string, snapshot: StylesheetSnapshot, uow: UnitOfWork): void {
    const stylesheet = mustExist(diagram.document.styles.getStyle(id));
    stylesheet.restore(snapshot, uow);
  }

  restore(snapshot: StylesheetSnapshot, element: Stylesheet<any>, uow: UnitOfWork): void {
    element.restore(snapshot, uow);
  }

  snapshot(element: Stylesheet<any>): StylesheetSnapshot {
    return element.snapshot();
  }

  children(_element: Stylesheet<any>) {
    return [];
  }
}

import {
  StylesheetSnapshot,
  UnitOfWork,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import { Stylesheet, StylesheetType } from '@diagram-craft/model/diagramStyles';
import { mustExist } from '@diagram-craft/utils/assert';
import { Diagram } from '@diagram-craft/model/diagram';

export class DiagramStylesUOWSpecification implements UOWTrackableSpecification<
  StylesheetSnapshot,
  Stylesheet<StylesheetType>
> {
  updateElement(diagram: Diagram, id: string, snapshot: StylesheetSnapshot, uow: UnitOfWork): void {
    const stylesheet = mustExist(diagram.document.styles.getStyle(id));
    stylesheet.restore(snapshot, uow);
  }

  onAfterCommit(_stylesheets: Array<Stylesheet<StylesheetType>>, _uow: UnitOfWork): void {}

  onBeforeCommit(_stylesheets: Array<Stylesheet<StylesheetType>>, _uow: UnitOfWork): void {}

  restore(snapshot: StylesheetSnapshot, e: Stylesheet<StylesheetType>, uow: UnitOfWork): void {
    e.restore(snapshot, uow);
  }

  snapshot(element: Stylesheet<StylesheetType>): StylesheetSnapshot {
    return element.snapshot();
  }
}

export class DiagramStylesParentChildUOWSpecification implements UOWTrackableParentChildSpecification<StylesheetSnapshot> {
  addElement(
    diagram: Diagram,
    _parentId: string,
    childId: string,
    child: StylesheetSnapshot,
    _idx: number,
    uow: UnitOfWork
  ): void {
    const styles = diagram.document.styles;

    const stylesheet = Stylesheet.fromSnapshot(child.type, child, styles.crdt.factory);
    styles.addStylesheet(childId, stylesheet, uow);
  }

  removeElement(diagram: Diagram, _parentId: string, child: string, uow: UnitOfWork): void {
    diagram.document.styles.deleteStylesheet(child, uow);
  }
}

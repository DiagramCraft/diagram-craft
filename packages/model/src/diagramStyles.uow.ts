import {
  Snapshot,
  UnitOfWork,
  UOWOperation,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import { DiagramStyles, Stylesheet, StylesheetType } from '@diagram-craft/model/diagramStyles';
import { mustExist } from '@diagram-craft/utils/assert';
import { Diagram } from '@diagram-craft/model/diagram';
import { EdgeProps, NodeProps } from '@diagram-craft/model/diagramProps';

export class DiagramStylesheetUOWSpecification implements UOWTrackableSpecification<
  StylesheetSnapshot,
  Stylesheet<StylesheetType>
> {
  id(e: Stylesheet<StylesheetType>): string {
    return e.id;
  }

  update(diagram: Diagram, id: string, snapshot: StylesheetSnapshot, uow: UnitOfWork): void {
    const stylesheet = mustExist(diagram.document.styles.getStyle(id));
    stylesheet.restore(snapshot, uow);
  }

  onBeforeCommit(_stylesheets: Array<UOWOperation>, _uow: UnitOfWork): void {}

  restore(snapshot: StylesheetSnapshot, e: Stylesheet<StylesheetType>, uow: UnitOfWork): void {
    e.restore(snapshot, uow);
  }

  snapshot(element: Stylesheet<StylesheetType>): StylesheetSnapshot {
    return element.snapshot();
  }
}

export class DiagramStylesUOWSpecification implements UOWTrackableSpecification<
  Snapshot,
  DiagramStyles
> {
  id(_e: DiagramStyles): string {
    return 'diagramStyles';
  }

  update(_diagram: Diagram, _id: string, _snapshot: Snapshot, _uow: UnitOfWork): void {}

  restore(_snapshot: Snapshot, _e: DiagramStyles, _uow: UnitOfWork): void {}

  snapshot(_element: DiagramStyles) {
    return {} as Snapshot;
  }
}

export class DiagramStylesParentChildUOWSpecification implements UOWTrackableParentChildSpecification<StylesheetSnapshot> {
  add(
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

  remove(diagram: Diagram, _parentId: string, child: string, uow: UnitOfWork): void {
    diagram.document.styles.deleteStylesheet(child, uow);
  }
}

export type StylesheetSnapshot = {
  id: string;
  name: string;
  props: NodeProps | EdgeProps;
  type: StylesheetType;
  _snapshotType: 'stylesheet';
};

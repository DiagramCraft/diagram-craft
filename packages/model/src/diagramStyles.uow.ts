import {
  Snapshot,
  UnitOfWork,
  UOWOperation,
  UOWChildAdapter,
  UOWAdapter,
  NotificationPhase
} from '@diagram-craft/model/unitOfWork';
import { DiagramStyles, Stylesheet, StylesheetType } from '@diagram-craft/model/diagramStyles';
import { mustExist } from '@diagram-craft/utils/assert';
import { Diagram } from '@diagram-craft/model/diagram';
import { EdgeProps, NodeProps } from '@diagram-craft/model/diagramProps';

export class StylesheetUOWAdapter implements UOWAdapter<
  StylesheetSnapshot,
  Stylesheet<StylesheetType>
> {
  id = (e: Stylesheet<StylesheetType>) => e.id;

  onNotify(operations: Array<UOWOperation>, _phase: NotificationPhase, uow: UnitOfWork): void {
    const handled = new Set<string>();
    for (const op of operations) {
      const key = `${op.type}/${op.target.id}`;
      if (handled.has(key)) continue;
      handled.add(key);

      switch (op.type) {
        case 'add':
          uow.diagram.document.styles.emit('stylesheetAdded', {
            stylesheet: op.target.object as Stylesheet
          });
          break;
        case 'update':
          uow.diagram.document.styles.emit('stylesheetUpdated', {
            stylesheet: op.target.object as Stylesheet
          });
          break;
        case 'remove':
          uow.diagram.document.styles.emit('stylesheetRemoved', {
            stylesheet: op.target.id
          });
          break;
      }
    }
  }

  update(diagram: Diagram, id: string, snapshot: StylesheetSnapshot, uow: UnitOfWork): void {
    const stylesheet = mustExist(diagram.document.styles.getStyle(id));
    stylesheet.restore(snapshot, uow);
  }

  restore(snapshot: StylesheetSnapshot, e: Stylesheet<StylesheetType>, uow: UnitOfWork): void {
    e.restore(snapshot, uow);
  }

  snapshot(element: Stylesheet<StylesheetType>): StylesheetSnapshot {
    return element.snapshot();
  }
}

export class DiagramStylesUOWAdapter implements UOWAdapter<Snapshot, DiagramStyles> {
  id = () => 'diagramStyles';

  update(_diagram: Diagram, _id: string, _snapshot: Snapshot, _uow: UnitOfWork): void {}

  restore(_snapshot: Snapshot, _e: DiagramStyles, _uow: UnitOfWork): void {}

  snapshot(_element: DiagramStyles) {
    return {} as Snapshot;
  }
}

export class DiagramStylesChildUOWAdapter implements UOWChildAdapter<StylesheetSnapshot> {
  add(
    diagram: Diagram,
    _parentId: string,
    childId: string,
    child: StylesheetSnapshot,
    _idx: number,
    uow: UnitOfWork
  ): void {
    const styles = diagram.document.styles;

    const stylesheet = Stylesheet.fromSnapshot(child.type, child, styles.crdt.factory, styles);
    styles.addStylesheet(childId, stylesheet, uow);
  }

  remove(diagram: Diagram, _parentId: string, child: string, uow: UnitOfWork): void {
    diagram.document.styles.deleteStylesheet(child, uow);
  }
}

export type StylesheetSnapshot = {
  id: string;
  parentId?: string | undefined;
  name: string;
  props: NodeProps | EdgeProps;
  type: StylesheetType;
  strokeColors?: string[];
  fillColors?: string[];
  _snapshotType: 'stylesheet';
};

import type { DiagramDocument } from './diagramDocument';
import type { Diagram } from './diagram';
import {
  type Snapshot,
  type UnitOfWork,
  type UOWAdapter,
  type UOWChildAdapter
} from './unitOfWork';
import { mustExist } from '@diagram-craft/utils/assert';
import type { DiagramSnapshot } from './diagram.uow';

export interface DiagramDocumentSnapshot extends Snapshot {
  _snapshotType: 'document';
  diagramOrder: string[];
  locked: boolean;
}

export class DiagramDocumentUOWAdapter
  implements UOWAdapter<DiagramDocumentSnapshot, DiagramDocument>
{
  id = (e: DiagramDocument) => e.id;

  snapshot(el: DiagramDocument): DiagramDocumentSnapshot {
    return {
      _snapshotType: 'document',
      diagramOrder: el._getDiagramOrder(),
      locked: el.locked
    };
  }

  restore(snap: DiagramDocumentSnapshot, el: DiagramDocument, uow: UnitOfWork): void {
    el._setDiagramOrder(snap.diagramOrder);
    el.setLocked(snap.locked, uow);
    // Notify UI that diagram order changed (e.g. after undo/redo of reorder)
    const anyDiagram = el.diagrams[0];
    if (anyDiagram) el.emit('diagramChanged', { diagram: anyDiagram });
  }

  update(diagram: Diagram, _id: string, snap: DiagramDocumentSnapshot, uow: UnitOfWork): void {
    diagram.document._setDiagramOrder(snap.diagramOrder);
    diagram.document.setLocked(snap.locked, uow);
    // Notify UI that diagram order changed (e.g. after undo/redo of reorder)
    diagram.document.emit('diagramChanged', { diagram });
  }
}

export class DocumentDiagramChildAdapter implements UOWChildAdapter<DiagramSnapshot> {
  add(
    diagram: Diagram,
    _parentId: string,
    _childId: string,
    snap: DiagramSnapshot,
    idx: number,
    _uow: UnitOfWork
  ): void {
    const parent = snap._ref.parent ? diagram.document.byId(snap._ref.parent) : undefined;
    diagram.document.insertDiagram(snap._ref, idx, parent);
  }

  remove(diagram: Diagram, _parentId: string, childId: string, _uow: UnitOfWork): void {
    diagram.document.removeDiagram(mustExist(diagram.document.byId(childId)));
  }
}

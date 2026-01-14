import {
  Snapshot,
  UnitOfWork,
  UOWAdapter,
  UOWChildAdapter,
  UOWOperation,
  UOWTrackable
} from '@diagram-craft/model/unitOfWork';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { SerializedEdge, SerializedNode } from '@diagram-craft/model/serialization/serializedTypes';

declare global {
  namespace DiagramCraft {
    interface UnitOfWorkMetadata {
      invalidated?: Set<UOWTrackable>;
    }
  }
}

type ElementSnapshot = DiagramNodeSnapshot | DiagramEdgeSnapshot;
export class DiagramElementUOWAdapter implements UOWAdapter<ElementSnapshot, DiagramElement> {
  id = (e: DiagramElement) => e.id;

  onBeforeCommit(operations: Array<UOWOperation>, uow: UnitOfWork): void {
    if (uow.isRemote) return;

    // At this point, any elements have been added and or removed
    const handled = new Set<string>();
    operations.forEach(({ target }) => {
      const el = target.object as DiagramElement;
      if (handled.has(el.id)) return;
      el.invalidate(uow);
      handled.add(el.id);
    });
  }

  onNotify(operations: Array<UOWOperation>, uow: UnitOfWork): void {
    const handled = new Set<string>();
    for (const op of operations) {
      const key = `${op.type}/${op.target.id}`;
      if (handled.has(key)) continue;
      handled.add(key);

      switch (op.type) {
        case 'add':
          uow.diagram.emit('elementAdd', { element: op.target.object as DiagramElement });
          break;
        case 'update':
          uow.diagram.emit('elementChange', {
            element: op.target.object as DiagramElement,
            silent: uow.metadata.nonDirty
          });
          break;
        case 'remove':
          uow.diagram.emit('elementRemove', { element: op.target.object as DiagramElement });
          break;
      }
    }

    // Batch
    const added = operations
      .filter(e => e.type === 'add')
      .map(e => e.target.object as DiagramElement);
    const updated = operations
      .filter(e => e.type === 'update')
      .map(e => e.target.object as DiagramElement);
    const removed = operations
      .filter(e => e.type === 'remove')
      .map(e => e.target.object as DiagramElement);
    uow.diagram.emit('elementBatchChange', { removed, updated, added });
  }

  update(diagram: Diagram, elementId: string, snapshot: ElementSnapshot, uow: UnitOfWork): void {
    const element = mustExist(diagram.lookup(elementId));
    element.restore(snapshot, uow);
  }

  restore(snapshot: ElementSnapshot, element: DiagramElement, uow: UnitOfWork): void {
    element.restore(snapshot, uow);
  }

  snapshot(element: DiagramElement): ElementSnapshot {
    return element.snapshot() as ElementSnapshot;
  }
}

export class DiagramElementChildUOWAdapter implements UOWChildAdapter<ElementSnapshot> {
  add(
    diagram: Diagram,
    parentId: string,
    _childId: string,
    childSnapshot: ElementSnapshot,
    idx: number,
    uow: UnitOfWork
  ) {
    const parent = mustExist(diagram.lookup(parentId));

    let child: DiagramElement;
    if (childSnapshot.type === 'node') {
      child = ElementFactory.nodeFromSnapshot(childSnapshot, parent.layer);
      child.restore(childSnapshot, uow);
    } else if (childSnapshot.type === 'edge') {
      child = ElementFactory.edgeFromSnapshot(childSnapshot, parent.layer);
      child.restore(childSnapshot, uow);
    } else {
      VERIFY_NOT_REACHED();
    }

    if (idx === -1) {
      parent.addChild(child, uow);
    } else {
      parent.addChild(child, uow, idx);
    }
  }

  remove(diagram: Diagram, parentId: string, childId: string, uow: UnitOfWork): void {
    const parent = mustExist(diagram.lookup(parentId));
    const child = mustExist(diagram.lookup(childId));
    parent.removeChild(child, uow);
  }
}

export type DiagramNodeSnapshot = Snapshot &
  Omit<SerializedNode, 'children'> & {
    _snapshotType: 'node';
    parentId?: string;
    children: string[];
  };

export type DiagramEdgeSnapshot = Snapshot &
  SerializedEdge & {
    _snapshotType: 'edge';
  };

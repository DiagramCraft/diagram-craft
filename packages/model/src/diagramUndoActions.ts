import { DiagramElement } from './diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { ElementsSnapshot, UnitOfWork } from './unitOfWork';
import { UndoableAction } from './undoManager';
import { Diagram } from './diagram';
import { Layer } from './diagramLayer';
import { hasSameElements } from '@diagram-craft/utils/array';

export const commitWithUndo = (uow: UnitOfWork, description: string) => {
  const snapshots = uow.commit();
  uow.diagram.undoManager.add(new SnapshotUndoableAction(description, uow.diagram, snapshots));
};

export class SnapshotUndoableAction implements UndoableAction {
  private afterSnapshot: ElementsSnapshot;

  timestamp?: Date;

  constructor(
    public readonly description: string,
    private readonly diagram: Diagram,
    private beforeSnapshot: ElementsSnapshot,
    afterSnapshot?: ElementsSnapshot
  ) {
    this.afterSnapshot = afterSnapshot ?? beforeSnapshot.retakeSnapshot(diagram);
  }

  undo(uow: UnitOfWork) {
    // TODO: Let's keep these for now... aids in debugging
    console.log('before', this.beforeSnapshot);
    console.log('after', this.afterSnapshot);

    for (const [id, snapshot] of this.beforeSnapshot.snapshots) {
      // Addition must be handled differently ... and explictly before this
      assert.present(snapshot);

      if (snapshot._snapshotType === 'layer') {
        const layer = this.diagram.layers.byId(id);
        if (layer) {
          layer.restore(snapshot, uow);
        }
      } else if (snapshot._snapshotType === 'layers') {
        this.diagram.layers.restore(snapshot, uow);
      } else if (snapshot._snapshotType === 'stylesheet') {
        const stylesheet = this.diagram.document.styles.get(id);
        if (stylesheet) {
          stylesheet.restore(snapshot, uow);
        }
      } else {
        const node = this.diagram.lookup(id);
        if (node) {
          node.restore(snapshot!, uow);
        }
      }
    }
  }

  redo(uow: UnitOfWork) {
    for (const [id, snapshot] of this.afterSnapshot.snapshots) {
      // Addition must be handled differently ... and explictly before this
      assert.present(snapshot);

      if (snapshot._snapshotType === 'layer') {
        const layer = this.diagram.layers.byId(id);
        if (layer) {
          layer.restore(snapshot, uow);
        }
      } else if (snapshot._snapshotType === 'layers') {
        this.diagram.layers.restore(snapshot, uow);
      } else if (snapshot._snapshotType === 'stylesheet') {
        const stylesheet = this.diagram.document.styles.get(id);
        if (stylesheet) {
          stylesheet.restore(snapshot, uow);
        }
      } else {
        const node = this.diagram.lookup(id);
        if (node) {
          node.restore(snapshot!, uow);
        }
      }
    }
  }

  merge(nextAction: UndoableAction): boolean {
    if (!(nextAction instanceof SnapshotUndoableAction)) return false;

    if (
      nextAction.description === this.description &&
      hasSameElements(nextAction.afterSnapshot.keys, this.afterSnapshot.keys) &&
      new Date().getTime() - this.timestamp!.getTime() < 2000
    ) {
      this.afterSnapshot = nextAction.afterSnapshot;
      this.timestamp = new Date();
      return true;
    }

    return false;
  }
}

export class ElementAddUndoableAction implements UndoableAction {
  readonly #layer: Layer;

  constructor(
    private readonly elements: ReadonlyArray<DiagramElement>,
    private readonly diagram: Diagram,
    public readonly description: string = 'Add node'
  ) {
    this.#layer = this.diagram.layers.active;
  }

  undo() {
    UnitOfWork.execute(this.diagram, uow => {
      this.elements.forEach(node => node.layer.removeElement(node, uow));
    });
  }

  redo() {
    UnitOfWork.execute(this.diagram, uow => {
      this.elements.forEach(node => this.#layer.addElement(node, uow));
    });
  }
}

export class ElementDeleteUndoableAction implements UndoableAction {
  description = 'Delete elements';
  private layer: Layer;
  private readonly elements: DiagramElement[];

  constructor(
    private readonly diagram: Diagram,
    elements: ReadonlyArray<DiagramElement>
  ) {
    this.layer = this.diagram.layers.active;
    this.elements = [...elements];
  }

  undo(uow: UnitOfWork): void {
    for (const element of this.elements) {
      this.layer.addElement(element, uow);
    }
    this.diagram.selectionState.setElements(this.elements);
  }

  redo(uow: UnitOfWork): void {
    for (const element of this.elements) {
      element.layer.removeElement(element, uow);
    }
    this.diagram.selectionState.clear();
  }
}

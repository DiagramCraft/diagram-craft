import { UndoableAction } from './undoManager.ts';
import { Diagram } from './diagram.ts';
import { Layer } from './diagramLayer.ts';
import { ElementsSnapshot, UnitOfWork } from './unitOfWork.ts';
import { DiagramElement } from './diagramElement.ts';
import { assert } from '../utils/assert.ts';

export const commitWithUndo = (uow: UnitOfWork, description: string) => {
  const snapshots = uow.commit();
  uow.diagram.undoManager.add(new SnapshotUndoableAction(description, uow.diagram, snapshots));
};

export class SnapshotUndoableAction implements UndoableAction {
  private readonly afterSnapshot: ElementsSnapshot;

  constructor(
    public readonly description: string,
    private readonly diagram: Diagram,
    private readonly beforeSnapshot: ElementsSnapshot,
    afterSnapshot?: ElementsSnapshot
  ) {
    this.afterSnapshot = afterSnapshot ?? beforeSnapshot.retakeSnapshot(diagram);
  }

  undo() {
    // Let's keep these for now... aids in debugging
    console.log('before', this.beforeSnapshot);
    console.log('after', this.afterSnapshot);

    const uow = new UnitOfWork(this.diagram);
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
    uow.commit();
  }

  redo() {
    const uow = new UnitOfWork(this.diagram);
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
    uow.commit();
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

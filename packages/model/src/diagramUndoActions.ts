import { DiagramElement, isNode } from './diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { ElementsSnapshot, UnitOfWork } from './unitOfWork';
import { UndoableAction } from './undoManager';
import { Diagram } from './diagram';
import { Layer, RegularLayer } from './diagramLayer';
import { hasSameElements } from '@diagram-craft/utils/array';

export const commitWithUndo = (uow: UnitOfWork, description: string) => {
  const snapshots = uow.commit();
  uow.diagram.undoManager.add(new SnapshotUndoableAction(description, uow.diagram, snapshots));
};

const restoreSnapshots = (e: ElementsSnapshot, diagram: Diagram, uow: UnitOfWork) => {
  for (const [id, snapshot] of e.snapshots) {
    // Addition must be handled differently ... and explictly before this
    assert.present(snapshot);

    if (snapshot._snapshotType === 'layer') {
      const layer = diagram.layers.byId(id);
      if (layer) {
        layer.restore(snapshot, uow);
      }
    } else if (snapshot._snapshotType === 'layers') {
      diagram.layers.restore(snapshot, uow);
    } else if (snapshot._snapshotType === 'stylesheet') {
      const stylesheet = diagram.document.styles.get(id);
      if (stylesheet) {
        stylesheet.restore(snapshot, uow);
      }
    } else {
      const node = diagram.lookup(id);
      if (node) {
        node.restore(snapshot!, uow);
      }
    }
  }
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
      // Addition must be handled differently ... and explicitly before this
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
    restoreSnapshots(this.afterSnapshot, this.diagram, uow);
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
      assert.true(this.#layer instanceof RegularLayer);
      this.elements.forEach(node => (node.layer as RegularLayer).removeElement(node, uow));
    });
    this.diagram.selectionState.setElements(
      this.diagram.selectionState.elements.filter(e => !this.elements.includes(e))
    );
  }

  redo() {
    UnitOfWork.execute(this.diagram, uow => {
      this.elements.forEach(node => {
        if (isNode(node)) {
          node.invalidateAnchors(uow);
        }
        assert.true(this.#layer instanceof RegularLayer);
        (this.#layer as RegularLayer).addElement(node, uow);
      });
    });
  }
}

export class ElementDeleteUndoableAction implements UndoableAction {
  description = 'Delete elements';
  private layer: Layer;
  private readonly elements: DiagramElement[];
  private snapshot: ElementsSnapshot | undefined;

  constructor(
    private readonly diagram: Diagram,
    elements: ReadonlyArray<DiagramElement>,
    private readonly restoreSelection: boolean
  ) {
    this.layer = this.diagram.layers.active;
    this.elements = [...elements];
  }

  undo(uow: UnitOfWork): void {
    for (const element of this.elements) {
      assert.true(this.layer instanceof RegularLayer);
      (this.layer as RegularLayer).addElement(element, uow);
    }

    assert.present(this.snapshot);
    restoreSnapshots(this.snapshot, this.diagram, uow);

    if (this.restoreSelection) {
      this.diagram.selectionState.setElements(this.elements);
    }
  }

  redo(uow: UnitOfWork): void {
    uow.trackChanges = true;
    for (const element of this.elements) {
      uow.snapshot(element);
      assert.true(element.layer instanceof RegularLayer);
      (element.layer as RegularLayer).removeElement(element, uow);
    }
    this.snapshot = uow.commit();

    if (this.restoreSelection) {
      this.diagram.selectionState.clear();
    }
  }
}

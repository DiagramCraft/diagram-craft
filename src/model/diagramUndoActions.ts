import { UndoableAction } from './undoManager.ts';
import { Diagram } from './diagram.ts';
import { DiagramNode } from './diagramNode.ts';
import { Layer } from './diagramLayer.ts';
import { DiagramNodeSnapshot, ElementsSnapshot, UnitOfWork } from './unitOfWork.ts';
import { DiagramElement } from './diagramElement.ts';
import { assert } from '../utils/assert.ts';

export class SnapshotUndoableAction implements UndoableAction {
  constructor(
    public readonly description: string,
    private readonly beforeSnapshot: ElementsSnapshot,
    private readonly afterSnapshot: ElementsSnapshot,
    private readonly diagram: Diagram
  ) {}

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

export class NodeChangeUndoableAction implements UndoableAction {
  #snapshots: ReadonlyArray<DiagramNodeSnapshot> = [];

  constructor(
    private readonly nodes: ReadonlyArray<DiagramNode>,
    private readonly diagram: Diagram,
    public readonly description: string
  ) {
    this.#snapshots = nodes.map(node => node.snapshot());
  }

  undo() {
    const newSnapshots = this.nodes.map(node => node.snapshot());

    UnitOfWork.execute(this.diagram, uow => {
      this.nodes.forEach(node => {
        node.restore(this.#snapshots.find(n => n.id === node.id)!, uow);
      });
    });

    this.#snapshots = newSnapshots;
  }

  redo() {
    const newSnapshots = this.nodes.map(node => node.snapshot());

    UnitOfWork.execute(this.diagram, uow => {
      this.nodes.forEach(node => {
        node.restore(this.#snapshots.find(n => n.id === node.id)!, uow);
      });
    });

    this.#snapshots = newSnapshots;
  }
}

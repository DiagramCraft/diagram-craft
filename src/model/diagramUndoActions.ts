import { UndoableAction } from './undoManager.ts';
import { Box } from '../geometry/box.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { Diagram } from './diagram.ts';
import { DiagramNode, DiagramNodeSnapshot } from './diagramNode.ts';
import { Layer } from './diagramLayer.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { DiagramElement } from './diagramElement.ts';

class AbstractTransformAction implements UndoableAction {
  readonly #elements: ReadonlyArray<DiagramElement>;
  readonly #source: ReadonlyArray<Box>;
  readonly #target: ReadonlyArray<Box>;
  readonly #diagram: Diagram;

  description: string;

  constructor(
    source: ReadonlyArray<Box>,
    target: ReadonlyArray<Box>,
    nodes: ReadonlyArray<DiagramElement>,
    diagram: Diagram,
    description: string
  ) {
    this.#diagram = diagram;
    this.#elements = [...nodes];
    this.#source = [...source];
    this.#target = [...target];
    this.description = description;
  }

  undo() {
    this.transformElementsAction(this.#target, this.#source);
  }

  redo() {
    this.transformElementsAction(this.#source, this.#target);
  }

  private transformElementsAction(source: ReadonlyArray<Box>, target: ReadonlyArray<Box>): void {
    const uow = new UnitOfWork(this.#diagram);
    for (let i = 0; i < this.#elements.length; i++) {
      this.#diagram.transformElements(
        [this.#elements[i]],
        TransformFactory.fromTo(source[i], target[i]),
        uow
      );
    }
    uow.commit();
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

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
      this.elements.forEach(node => node.layer!.removeElement(node, uow));
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

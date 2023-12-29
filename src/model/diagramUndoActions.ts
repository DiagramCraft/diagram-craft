import { UndoableAction } from './undoManager.ts';
import { Box } from '../geometry/box.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { Diagram, UnitOfWork } from './diagram.ts';
import { DiagramElement, DiagramNode, DiagramNodeSnapshot } from './diagramNode.ts';
import { Layer } from './diagramLayer.ts';

class AbstractTransformAction implements UndoableAction {
  private elements: DiagramElement[] = [];
  private source: Box[] = [];
  private target: Box[] = [];
  private diagram: Diagram;

  description: string;

  constructor(
    source: Box[],
    target: Box[],
    nodes: ReadonlyArray<DiagramElement>,
    diagram: Diagram,
    description: string
  ) {
    this.diagram = diagram;
    this.elements.push(...nodes);
    this.source.push(...source);
    this.target.push(...target);
    this.description = description;
  }

  undo() {
    this.transformElementsAction(this.target, this.source);
  }

  redo() {
    this.transformElementsAction(this.source, this.target);
  }

  private transformElementsAction(source: Box[], target: Box[]): void {
    const uow = new UnitOfWork(this.diagram);
    for (let i = 0; i < this.elements.length; i++) {
      this.diagram.transformElements(
        [this.elements[i]],
        TransformFactory.fromTo(source[i], target[i]),
        () => true,
        uow
      );
    }
    uow.commit();
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

// TODO: Do we want to reset the selection here?
export class NodeAddAction implements UndoableAction {
  private layer: Layer;

  constructor(
    private readonly nodes: DiagramNode[],
    private readonly diagram: Diagram,
    public readonly description: string = 'Add node'
  ) {
    this.layer = this.diagram.layers.active;
  }

  undo() {
    this.nodes.forEach(node => node.layer!.removeElement(node));
  }

  redo() {
    this.nodes.forEach(node => this.layer.addElement(node));
  }
}

export class NodeChangeAction implements UndoableAction {
  private snapshots: DiagramNodeSnapshot[] = [];
  description: string;

  constructor(
    private readonly nodes: DiagramNode[],
    private readonly diagram: Diagram,
    description: string
  ) {
    this.snapshots = nodes.map(node => node.snapshot());
    this.description = description;
  }

  undo() {
    const newSnapshots = this.nodes.map(node => node.snapshot());

    this.nodes.forEach(node => {
      node.restore(this.snapshots.find(n => n.id === node.id)!);
      this.diagram.updateElement(node);
    });

    this.snapshots = newSnapshots;
  }

  redo() {
    const newSnapshots = this.nodes.map(node => node.snapshot());

    this.nodes.forEach(node => {
      node.restore(this.snapshots.find(n => n.id === node.id)!);
      this.diagram.updateElement(node);
    });

    this.snapshots = newSnapshots;
  }
}

import { UndoableAction } from '../model-editor/undoManager.ts';
import { Box } from '../geometry/box.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { Diagram } from './diagram.ts';
import { DiagramNode, DiagramNodeSnapshot } from './diagramNode.ts';

class AbstractTransformAction implements UndoableAction {
  private nodes: DiagramNode[] = [];
  private source: Box[] = [];
  private target: Box[] = [];
  private diagram: Diagram;

  canUndo = true;
  canRedo = true;

  description: string;

  constructor(
    source: Box[],
    target: Box[],
    nodes: DiagramNode[],
    diagram: Diagram,
    description: string
  ) {
    this.diagram = diagram;
    this.nodes.push(...nodes);
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
    for (let i = 0; i < this.nodes.length; i++) {
      this.diagram.transformElements(
        [this.nodes[i]],
        TransformFactory.fromTo(source[i], target[i])
      );
    }
    this.diagram.undoManager.clearPending();
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

export class NodeAddAction implements UndoableAction {
  canUndo = true;
  canRedo = true;
  description = 'Add node';

  constructor(
    private readonly nodes: DiagramNode[],
    private readonly diagram: Diagram
  ) {}

  undo() {
    this.nodes.forEach(node => this.diagram.removeNode(node));
    this.diagram.undoManager.clearPending();
  }

  redo() {
    this.nodes.forEach(node => this.diagram.addNode(node));
    this.diagram.undoManager.clearPending();
  }
}

export class NodeChangeAction implements UndoableAction {
  private snapshots: DiagramNodeSnapshot[] = [];
  canUndo: boolean;
  canRedo: boolean;
  description: string;

  constructor(
    private readonly nodes: DiagramNode[],
    private readonly diagram: Diagram,
    description: string
  ) {
    this.snapshots = nodes.map(node => node.snapshot());
    this.canUndo = true;
    this.canRedo = true;
    this.description = description;
  }

  undo() {
    const newSnapshots = this.nodes.map(node => node.snapshot());

    this.nodes.forEach(node => {
      node.restore(this.snapshots.find(n => n.id === node.id)!);
      this.diagram.updateElement(node);
    });
    this.diagram.undoManager.clearPending();

    this.snapshots = newSnapshots;

    this.canUndo = false;
    this.canRedo = true;
  }

  redo() {
    const newSnapshots = this.nodes.map(node => node.snapshot());

    this.nodes.forEach(node => {
      node.restore(this.snapshots.find(n => n.id === node.id)!);
      this.diagram.updateElement(node);
    });
    this.diagram.undoManager.clearPending();

    this.snapshots = newSnapshots;

    this.canUndo = true;
    this.canRedo = false;
  }
}

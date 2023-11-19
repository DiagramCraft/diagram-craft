import { UndoableAction } from '../model-editor/undoManager.ts';
import { Box } from '../geometry/box.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { Diagram, DiagramNode, DiagramNodeSnapshot } from './diagram.ts';

class AbstractTransformAction implements UndoableAction {
  private nodes: DiagramNode[] = [];
  private source: Box[] = [];
  private target: Box[] = [];
  private diagram: Diagram;

  constructor(source: Box[], target: Box[], nodes: DiagramNode[], diagram: Diagram) {
    this.diagram = diagram;
    this.nodes.push(...nodes);
    this.source.push(...source);
    this.target.push(...target);
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
  private after: DiagramNodeSnapshot[] = [];
  private before: DiagramNodeSnapshot[];

  constructor(
    private readonly nodes: DiagramNode[],
    private readonly diagram: Diagram
  ) {
    this.before = nodes.map(node => node.snapshot());
  }

  commit() {
    this.after = this.nodes.map(node => node.snapshot());
  }

  undo() {
    this.nodes.forEach(node => {
      node.restore(this.before.find(n => n.id === node.id)!);
      this.diagram.updateElement(node);
    });
    this.diagram.undoManager.clearPending();
  }

  redo() {
    this.nodes.forEach(node => {
      node.restore(this.after.find(n => n.id === node.id)!);
      this.diagram.updateElement(node);
    });
    this.diagram.undoManager.clearPending();
  }
}

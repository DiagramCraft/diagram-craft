import { UndoableAction } from '../model-editor/undoManager.ts';
import { Box } from '../geometry/box.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { Diagram, ResolvedNodeDef } from './diagram.ts';

class AbstractTransformAction implements UndoableAction {
  private nodes: ResolvedNodeDef[] = [];
  private source: Box[] = [];
  private target: Box[] = [];
  private diagram: Diagram;

  constructor(source: Box[], target: Box[], nodes: ResolvedNodeDef[], diagram: Diagram) {
    this.diagram = diagram;
    this.nodes.push(...nodes);
    this.source.push(...source);
    this.target.push(...target);
  }

  undo() {
    this.transformNodesAction(this.target, this.source);
  }

  redo() {
    this.transformNodesAction(this.source, this.target);
  }

  private transformNodesAction(source: Box[], target: Box[]): void {
    for (let i = 0; i < this.nodes.length; i++) {
      this.diagram.transformNodes([this.nodes[i]], TransformFactory.fromTo(source[i], target[i]));
    }
    this.diagram.undoManager.clearPending();
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

export class NodeAddAction implements UndoableAction {
  constructor(
    private readonly nodes: ResolvedNodeDef[],
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

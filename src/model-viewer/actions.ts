import { UndoableAction } from '../model-editor/undoManager.ts';
import { Box } from '../geometry/box.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { Diagram } from './diagram.ts';
import { DiagramNode, DiagramNodeSnapshot } from './diagramNode.ts';
import { DiagramEdge } from './diagramEdge.ts';

class AbstractTransformAction implements UndoableAction {
  private nodes: (DiagramNode | DiagramEdge)[] = [];
  private source: Box[] = [];
  private target: Box[] = [];
  private diagram: Diagram;

  description: string;

  constructor(
    source: Box[],
    target: Box[],
    nodes: (DiagramNode | DiagramEdge)[],
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
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

export class NodeAddAction implements UndoableAction {
  description = 'Add node';

  constructor(
    private readonly nodes: DiagramNode[],
    private readonly diagram: Diagram
  ) {}

  undo() {
    this.nodes.forEach(node => this.diagram.removeNode(node));
  }

  redo() {
    this.nodes.forEach(node => this.diagram.addNode(node));
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

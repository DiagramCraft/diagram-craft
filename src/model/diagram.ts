import { Box, Transform, TransformFactory } from '../geometry/geometry.ts';
import { UndoableAction, UndoManager } from './undoManager.ts';
import { EventEmitter } from '../utils/event.ts';

export interface AbstractNodeDef {
  type: 'node';
  nodeType: 'group' | string;
  id: string;

  bounds: Box;

  // TODO: We should use interface for this and make it extendable by nodeType
  props?: Record<string, unknown>;
}

export interface AbstractEdgeDef {
  type: 'edge';
  id: string;
}

export interface ResolvedNodeDef extends AbstractNodeDef {
  parent?: ResolvedNodeDef;

  edges?: Record<string, ResolvedEdgeDef[]>;
  children: ResolvedNodeDef[];
}

export interface ResolvedEdgeDef extends AbstractEdgeDef {
  start: { anchor: string; node: ResolvedNodeDef };
  end: { anchor: string; node: ResolvedNodeDef };
}

export type DiagramEvents = {
  nodechanged: { before: ResolvedNodeDef; after: ResolvedNodeDef };
  nodeadded: { node: ResolvedNodeDef };
  noderemoved: { node: ResolvedNodeDef };
  edgechanged: { before: ResolvedEdgeDef; after: ResolvedEdgeDef };
  edgeadded: { edge: ResolvedEdgeDef };
  edgeremoved: { edge: ResolvedEdgeDef };
  change: void;
};

export class LoadedDiagram extends EventEmitter<DiagramEvents> {
  elements: (ResolvedEdgeDef | ResolvedNodeDef)[];
  nodeLookup: Record<string, ResolvedNodeDef>;
  edgeLookup: Record<string, ResolvedEdgeDef>;
  undoManager = new UndoManager(() => {
    this.emit('change');
  });

  constructor(
    elements: (ResolvedEdgeDef | ResolvedNodeDef)[],
    nodeLookup: Record<string, ResolvedNodeDef>,
    edgeLookup: Record<string, ResolvedEdgeDef>
  ) {
    super();
    this.elements = elements;
    this.nodeLookup = nodeLookup;
    this.edgeLookup = edgeLookup;
  }

  addNode(node: ResolvedNodeDef) {
    this.nodeLookup[node.id] = node;
    this.elements.push(node);
    this.emit('nodeadded', { node });
  }

  removeNode(node: ResolvedNodeDef) {
    delete this.nodeLookup[node.id];
    this.elements = this.elements.filter(e => e !== node);
    this.emit('noderemoved', { node });
  }

  updateNodeProps(node: ResolvedNodeDef, props: Record<string, unknown>) {
    node.props = props;
    // TODO: Need to keep a before state
    this.emit('nodechanged', { before: node, after: node });
  }

  transformNodes(nodes: ResolvedNodeDef[], transforms: Transform[]) {
    const before = nodes.map(n => NodeDef.cloneBounds(n));

    for (const node of nodes) {
      node.bounds = Transform.box(node.bounds, ...transforms);
    }

    for (let i = 0; i < nodes.length; i++) {
      this.emit('nodechanged', { before: before[i], after: nodes[i] });
    }

    // TODO: Automatically create undoable action?
  }

  addEdge(edge: ResolvedEdgeDef) {
    this.edgeLookup[edge.id] = edge;
    this.elements.push(edge);
    this.emit('edgeadded', { edge });
  }

  removeEdge(edge: ResolvedEdgeDef) {
    delete this.edgeLookup[edge.id];
    this.elements = this.elements.filter(e => e !== edge);
    this.emit('edgeremoved', { edge });
  }
}

export const NodeDef = {
  cloneBounds: (node: ResolvedNodeDef): ResolvedNodeDef => {
    return {
      ...node,
      bounds: {
        pos: { ...node.bounds.pos },
        size: { ...node.bounds.size },
        rotation: node.bounds.rotation
      },
      children: node.children.map(c => NodeDef.cloneBounds(c))
    };
  },

  transform: (node: ResolvedNodeDef, before: Box, after: Box) => {
    node.bounds = Transform.box(node.bounds, ...TransformFactory.fromTo(before, after));

    for (const cn of node.children) {
      NodeDef.transform(cn, before, after);
    }
  },

  edges: (node: ResolvedNodeDef): ResolvedEdgeDef[] => {
    return [
      ...Object.values(node.edges ?? {}).flatMap(e => e),
      ...node.children.flatMap(c => NodeDef.edges(c))
    ];
  }
};

class AbstractTransformAction implements UndoableAction {
  private nodes: ResolvedNodeDef[] = [];
  private source: Box[] = [];
  private target: Box[] = [];
  private diagram: LoadedDiagram;

  constructor(source: Box[], target: Box[], nodes: ResolvedNodeDef[], diagram: LoadedDiagram) {
    this.diagram = diagram;
    for (let i = 0; i < target.length; i++) {
      this.nodes.push(nodes[i]);
      this.source.push(source[i]);
      this.target.push(target[i]);
    }
  }

  undo() {
    for (let i = 0; i < this.nodes.length; i++) {
      this.diagram.transformNodes(
        [this.nodes[i]],
        TransformFactory.fromTo(this.target[i], this.source[i])
      );
    }
    this.diagram.undoManager.clearPending();
  }

  redo() {
    for (let i = 0; i < this.nodes.length; i++) {
      this.diagram.transformNodes(
        [this.nodes[i]],
        TransformFactory.fromTo(this.source[i], this.target[i])
      );
    }
    this.diagram.undoManager.clearPending();
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

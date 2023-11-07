import { Box, Transform, TransformFactory } from '../geometry.ts';
import { UndoableAction, UndoManager } from './UndoManager.ts';
import { EventEmitter } from './event.ts';

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

export class LoadedDiagram extends EventEmitter<{
  nodechanged: { before: ResolvedNodeDef; after: ResolvedNodeDef };
  nodeadded: { node: ResolvedNodeDef };
  noderemoved: { node: ResolvedNodeDef };
  edgechanged: { before: ResolvedEdgeDef; after: ResolvedEdgeDef };
  edgeadded: { edge: ResolvedEdgeDef };
  edgeremoved: { edge: ResolvedEdgeDef };
  change: void;
}> {
  elements: (ResolvedEdgeDef | ResolvedNodeDef)[];
  nodeLookup: Record<string, ResolvedNodeDef>;
  edgeLookup: Record<string, ResolvedEdgeDef>;
  undoManager = new UndoManager(() => {
    this.commit();
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

  transformNode(nodes: ResolvedNodeDef[], transforms: Transform[]) {
    for (const node of nodes) {
      node.bounds = Transform.box(node.bounds, ...transforms);
    }

    for (const node of nodes) {
      // TODO: Need to keep a before state
      this.emit('nodechanged', { before: node, after: node });
    }
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

  // TODO: We should change this
  commit() {
    this.emit('change');
  }
}

export const NodeDef = {
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

  constructor(source: Box[], target: Box[], nodes: ResolvedNodeDef[]) {
    for (let i = 0; i < target.length; i++) {
      this.nodes.push(nodes[i]);
      this.source.push(source[i]);
      this.target.push(target[i]);
    }
  }

  undo() {
    for (let i = 0; i < this.nodes.length; i++) {
      NodeDef.transform(this.nodes[i], this.target[i], this.source[i]);
    }
  }

  redo() {
    for (let i = 0; i < this.nodes.length; i++) {
      NodeDef.transform(this.nodes[i], this.source[i], this.target[i]);
    }
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

import { EventEmitter } from '../utils/event.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { Transform } from '../geometry/transform.ts';
import { Box } from '../geometry/box.ts';
import { UndoManager } from '../model-editor/undoManager.ts';
import { Viewbox } from './viewBox.ts';
import { NodeHelper } from './nodeHelper.ts';

export interface DiagramElement {
  id: string;
  type: string;
}

export interface AbstractNode extends DiagramElement {
  type: 'node';
  nodeType: 'group' | string;
  id: string;

  bounds: Box;

  // TODO: We should use interface for this and make it extendable by nodeType
  props?: Record<string, unknown>;
}

export interface AbstractEdge extends DiagramElement {
  type: 'edge';
  id: string;
}

export interface DiagramNode extends AbstractNode {
  parent?: DiagramNode;

  edges?: Record<string, DiagramEdge[]>;
  children: DiagramNode[];
}

export interface DiagramEdge extends AbstractEdge {
  start: { anchor: string; node: DiagramNode };
  end: { anchor: string; node: DiagramNode };
}

export type Canvas = Omit<Box, 'rotation'>;

export type DiagramEvents = {
  nodechanged: { before: DiagramNode; after: DiagramNode };
  nodeadded: { node: DiagramNode };
  noderemoved: { node: DiagramNode };
  edgechanged: { before: DiagramEdge; after: DiagramEdge };
  edgeadded: { edge: DiagramEdge };
  edgeremoved: { edge: DiagramEdge };
  canvaschanged: { before: Canvas; after: Canvas };
};

export class Diagram extends EventEmitter<DiagramEvents> {
  elements: (DiagramEdge | DiagramNode)[];
  readonly nodeLookup: Record<string, DiagramNode> = {};
  readonly edgeLookup: Record<string, DiagramEdge> = {};
  readonly undoManager = new UndoManager();

  #canvas: Canvas = {
    pos: { x: 0, y: 0 },
    size: {
      w: 640,
      h: 640
    }
  };

  viewBox = new Viewbox(this.#canvas.size);

  // TODO: Add listener/event on grid change
  readonly grid = {
    x: 20,
    y: 20
  };

  constructor(elements: (DiagramEdge | DiagramNode)[]) {
    super();
    this.elements = elements;

    for (const e of this.elements) {
      if (e.type === 'edge') {
        this.edgeLookup[e.id] = e;
      } else if (e.type === 'node') {
        this.nodeLookup[e.id] = e;
      } else {
        VERIFY_NOT_REACHED();
      }
    }
  }

  get canvas() {
    return this.#canvas;
  }

  set canvas(b: Canvas) {
    const before = this.#canvas;
    this.#canvas = b;
    this.emit('canvaschanged', { before, after: b });

    console.log('CANVAS CHANGED');
  }

  newid() {
    return Math.random().toString(36).substring(2, 9);
  }

  addNode(node: DiagramNode) {
    this.nodeLookup[node.id] = node;
    this.elements.push(node);
    this.emit('nodeadded', { node });
  }

  removeNode(node: DiagramNode) {
    delete this.nodeLookup[node.id];
    this.elements = this.elements.filter(e => e !== node);
    this.emit('noderemoved', { node });
  }

  updateNodeProps(node: DiagramNode, props: Record<string, unknown>) {
    node.props = props;
    // TODO: Need to keep a before state
    this.emit('nodechanged', { before: node, after: node });
  }

  // TODO: Implement this part
  queryNodes() {
    return Object.values(this.nodeLookup);
  }

  transformNodes(nodes: DiagramNode[], transforms: Transform[]) {
    const before = nodes.map(n => NodeHelper.cloneNodeBounds(n));

    for (const node of nodes) {
      node.bounds = Transform.box(node.bounds, ...transforms);
    }

    for (const node of nodes) {
      if (node.nodeType === 'group') {
        this.transformNodes(node.children, transforms);
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      this.emit('nodechanged', { before: before[i], after: nodes[i] });
    }

    // TODO: Automatically create undoable action?
  }

  addEdge(edge: DiagramEdge) {
    this.edgeLookup[edge.id] = edge;
    this.elements.push(edge);
    this.emit('edgeadded', { edge });
  }

  removeEdge(edge: DiagramEdge) {
    delete this.edgeLookup[edge.id];
    this.elements = this.elements.filter(e => e !== edge);
    this.emit('edgeremoved', { edge });
  }
}

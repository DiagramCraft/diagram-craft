import {
  Angle,
  Box,
  Extent,
  Point,
  Rotation,
  Transform,
  Translation,
  Vector
} from '../geometry.ts';
import { UndoableAction, UndoManager } from './UndoManager.ts';
import { EventEmitter } from './event.ts';

export interface AbstractNodeDef {
  type: 'node';
  nodeType: 'group' | string;
  id: string;

  // Note, here position is in local coordinates
  pos: Point;
  size: Extent;
  rotation?: number;

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
      const newBox = Transform.box(node, ...transforms);
      node.pos = newBox.pos;
      node.size = newBox.size;
      node.rotation = newBox.rotation;
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
  move: (node: ResolvedNodeDef, d: Point) => {
    node.pos = Point.add(node.pos, d);
    for (const cn of node.children) {
      NodeDef.move(cn, d);
    }
  },

  transform: (node: ResolvedNodeDef, before: Box, after: Box) => {
    // TODO: Why do we need this fast-path?
    // TODO: Add tests for this
    // Fast-path when the node and selection are the same
    if (node.size.w === before.size.w && node.size.h === before.size.h) {
      node.size.w = after.size.w;
      node.size.h = after.size.h;
      node.pos.x = after.pos.x;
      node.pos.y = after.pos.y;
      node.rotation = after.rotation;
    } else {
      // Calculate relative position of node within before
      const relX = (node.pos.x - before.pos.x) / before.size.w;
      const relY = (node.pos.y - before.pos.y) / before.size.h;

      // Calculate relative size of node within before
      const relW = node.size.w / before.size.w;
      const relH = node.size.h / before.size.h;

      // Calculate new position of node within after
      node.pos.x = after.pos.x + relX * after.size.w;
      node.pos.y = after.pos.y + relY * after.size.h;

      // Calculate new size of node within after
      node.size.w = relW * after.size.w;
      node.size.h = relH * after.size.h;

      if (before.rotation !== after.rotation) {
        const center = new Translation(Vector.negate(Box.center(before)));
        const rotate = new Rotation(Angle.toRad((after.rotation ?? 0) - (before.rotation ?? 0)));
        const moveBack = center.reverse();

        const np = Transform.coord(Box.center(node), center, rotate, moveBack);

        Box.moveCenterPoint(node, np);

        node.rotation = after.rotation;
      }
    }

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
      this.source.push(Box.snapshot(source[i]));
      this.target.push(Box.snapshot(target[i]));
    }
  }

  undo() {
    for (let i = 0; i < this.nodes.length; i++) {
      NodeDef.transform(this.nodes[i], this.target[i], this.source[i]);
      //      this.nodes[i].rotation = this.source[i].rotation;
      //      this.nodes[i].pos = this.source[i].pos;
      //      this.nodes[i].size = this.source[i].size;
    }
  }

  redo() {
    for (let i = 0; i < this.nodes.length; i++) {
      NodeDef.transform(this.nodes[i], this.source[i], this.target[i]);
      //      this.nodes[i].rotation = this.target[i].rotation;
      //      this.nodes[i].pos = this.target[i].pos;
      //      this.nodes[i].size = this.target[i].size;
    }
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

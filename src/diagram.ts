import { Angle, Box, Point, Extent, Rotation, Transform, Translation, Vector } from './geometry.ts';
import { VERIFY_NOT_REACHED } from './assert.ts';
import { UndoableAction, UndoManager } from './UndoManager.ts';

export interface Reference {
  id: string;
}

export interface AbstractNodeDef {
  type: 'node';
  nodeType: 'group' | string;
  id: string;

  // Note, here position is in local coordinates
  pos: Point;
  size: Extent;
  rotation?: number;
}

export interface AbstractEdgeDef {
  type: 'edge';
  id: string;
}

export interface SerializedNodeDef extends AbstractNodeDef {
  edges?: Record<string, Reference[]>;

  // TODO: Should allow edges as part of group
  children: SerializedNodeDef[];
}

export interface SerializedEdgeDef extends AbstractEdgeDef {
  start: { anchor: string; node: Reference };
  end: { anchor: string; node: Reference };
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

export interface Diagram {
  elements: (SerializedNodeDef | SerializedEdgeDef)[];
}

type Listener = () => void;

export class LoadedDiagram {
  elements: (ResolvedEdgeDef | ResolvedNodeDef)[];
  nodeLookup: Record<string, ResolvedNodeDef>;
  edgeLookup: Record<string, ResolvedEdgeDef>;
  undoManager = new UndoManager(() => {
    this.commit();
  });

  private listeners: Listener[];

  constructor(
    elements: (ResolvedEdgeDef | ResolvedNodeDef)[],
    nodeLookup: Record<string, ResolvedNodeDef>,
    edgeLookup: Record<string, ResolvedEdgeDef>
  ) {
    this.elements = elements;
    this.nodeLookup = nodeLookup;
    this.edgeLookup = edgeLookup;
    this.listeners = [];
  }

  commit() {
    this.listeners.forEach(l => l());
  }

  addListener(l: Listener) {
    this.listeners.push(l);
  }

  removeListener(l: Listener) {
    this.listeners = this.listeners.filter(l2 => l2 !== l);
  }
}

const unfoldGroup = (node: SerializedNodeDef) => {
  const recurse = (
    nodes: SerializedNodeDef[],
    parent?: SerializedNodeDef | undefined
  ): (SerializedNodeDef & { parent?: SerializedNodeDef | undefined })[] => {
    return [...nodes.map(n => ({ ...n, parent })), ...nodes.flatMap(n => recurse(n.children, n))];
  };

  if (node.nodeType === 'group') {
    return [{ ...node }, ...recurse(node.children, node)];
  } else {
    return [{ ...node }];
  }
};

const isNodeDef = (element: SerializedNodeDef | SerializedEdgeDef): element is SerializedNodeDef =>
  element.type === 'node';

export const loadDiagram = (diagram: Diagram): LoadedDiagram => {
  const nodeLookup: Record<string, ResolvedNodeDef> = {};
  const edgeLookup: Record<string, ResolvedEdgeDef> = {};

  const allNodes = diagram.elements.filter(isNodeDef);

  // Index skeleton nodes
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      nodeLookup[c.id] = {
        ...c,
        parent: undefined,
        edges: {},
        children: []
      };
    }
  }

  // Resolve relative positions
  for (const n of allNodes) {
    for (const child of unfoldGroup(n)) {
      if (child.parent) {
        nodeLookup[child.id].pos = Point.add(
          nodeLookup[child.id].pos,
          nodeLookup[child.parent.id].pos
        );
      }
    }
  }

  // Resolve relations
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      nodeLookup[c.id].children = c.children.map(c2 => nodeLookup[c2.id]);
      if (c.parent) {
        nodeLookup[n.id].parent = nodeLookup[c.parent.id];
      }
    }
  }

  for (const e of diagram.elements) {
    if (e.type !== 'edge') continue;

    const edge = {
      ...e,
      start: { anchor: e.start.anchor, node: nodeLookup[e.start.node.id] },
      end: { anchor: e.end.anchor, node: nodeLookup[e.end.node.id] }
    };

    const startNode = nodeLookup[edge.start.node.id];

    startNode.edges ??= {};
    startNode.edges[edge.start.anchor] ??= [];
    startNode.edges[edge.start.anchor].push(edge);

    const endNode = nodeLookup[edge.end.node.id];

    endNode.edges ??= {};
    endNode.edges[edge.end.anchor] ??= [];
    endNode.edges[edge.end.anchor].push(edge);

    edgeLookup[e.id] = edge;
  }

  const elements: (ResolvedEdgeDef | ResolvedNodeDef)[] = [];
  for (const n of diagram.elements) {
    if (n.type === 'node') {
      elements.push(nodeLookup[n.id]);
    } else if (n.type === 'edge') {
      elements.push(edgeLookup[n.id]);
    } else {
      VERIFY_NOT_REACHED();
    }
  }

  return new LoadedDiagram(elements, nodeLookup, edgeLookup);
};

export const NodeDef = {
  move: (node: ResolvedNodeDef, d: Point) => {
    node.pos = Point.add(node.pos, d);
    for (const cn of node.children) {
      NodeDef.move(cn, d);
    }
  },

  transform: (node: ResolvedNodeDef, before: Box, after: Box) => {
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

    for (const cn of node.children) {
      NodeDef.transform(cn, before, after);
    }
  },

  edges: (node: ResolvedNodeDef): SerializedEdgeDef[] => {
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
      this.nodes[i].rotation = this.source[i].rotation;
      this.nodes[i].pos = this.source[i].pos;
      this.nodes[i].size = this.source[i].size;
    }
  }

  redo() {
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].rotation = this.target[i].rotation;
      this.nodes[i].pos = this.target[i].pos;
      this.nodes[i].size = this.target[i].size;
    }
  }
}

export class MoveAction extends AbstractTransformAction {}

export class RotateAction extends AbstractTransformAction {}

export class ResizeAction extends AbstractTransformAction {}

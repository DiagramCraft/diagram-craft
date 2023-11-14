import { Box, Direction, Line, Point, Transform, TransformFactory } from '../geometry/geometry.ts';
import { Range } from '../geometry/range.ts';
import { UndoableAction, UndoManager } from './undoManager.ts';
import { EventEmitter } from '../utils/event.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';

/*
type BoundsCriteria = {
  criteria: 'bounds';
  bounds: Box;
  type: ('intersect' | 'corners' | 'center' | 'alignment-anchors')[];
  mode: 'any' | 'all';
};

type NodeQueryCriteria = BoundsCriteria;

type NodeQuery = {
  criteria: NodeQueryCriteria[];
};
*/

const cloneNodeBounds = (node: ResolvedNodeDef): ResolvedNodeDef => {
  return {
    ...node,
    bounds: {
      pos: { ...node.bounds.pos },
      size: { ...node.bounds.size },
      rotation: node.bounds.rotation
    },
    children: node.children.map(c => cloneNodeBounds(c))
  };
};

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
  readonly nodeLookup: Record<string, ResolvedNodeDef> = {};
  readonly edgeLookup: Record<string, ResolvedEdgeDef> = {};
  readonly undoManager = new UndoManager();
  readonly dimensions = {
    w: 640,
    h: 480
  };

  constructor(elements: (ResolvedEdgeDef | ResolvedNodeDef)[]) {
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

  // TODO: Implement this part
  queryNodes() {
    return Object.values(this.nodeLookup);
  }

  transformNodes(nodes: ResolvedNodeDef[], transforms: Transform[]) {
    const before = nodes.map(n => cloneNodeBounds(n));

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

type BaseAnchor = {
  line: Line;
  axis: Axis;
  matchDirection?: Direction;
  respectDirection?: boolean;
};

export type DistancePair = {
  distance: number;

  pointA: Point;
  pointB: Point;

  rangeA: Range;
  rangeB: Range;
};

export type Anchor = BaseAnchor &
  (
    | {
        type: 'source' | 'canvas' | 'grid';
      }
    | {
        type: 'node';
        node: ResolvedNodeDef;
      }
    | {
        type: 'distance';
        distancePairs: DistancePair[];
      }
  );

export type AnchorType = Anchor['type'];

export type AnchorOfType<T extends AnchorType> = Anchor & { type: T };

export type Axis = 'h' | 'v';

export const Axis = {
  orthogonal: (axis: Axis): Axis => (axis === 'h' ? 'v' : 'h'),
  axises: (): Axis[] => ['h', 'v'],
  toXY: (axis: Axis): 'x' | 'y' => (axis === 'h' ? 'x' : 'y')
};

export const NodeHelper = {
  edges: (node: ResolvedNodeDef): ResolvedEdgeDef[] => {
    return [
      ...Object.values(node.edges ?? {}).flatMap(e => e),
      ...node.children.flatMap(c => NodeHelper.edges(c))
    ];
  },

  // TODO: Maybe include use corners for rotated nodes somehow
  anchors: (node: Box, type: 'source' = 'source'): Anchor[] => {
    const center: Anchor[] = [
      {
        line: {
          from: { x: node.pos.x, y: node.pos.y + node.size.h / 2 },
          to: { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h / 2 }
        },
        axis: 'h',
        type
      },
      {
        line: {
          from: { x: node.pos.x + node.size.w / 2, y: node.pos.y },
          to: { x: node.pos.x + node.size.w / 2, y: node.pos.y + node.size.h }
        },
        axis: 'v',
        type
      }
    ];

    if (node.rotation !== 0) return center;

    center.push({
      line: {
        from: { x: node.pos.x, y: node.pos.y },
        to: { x: node.pos.x + node.size.w, y: node.pos.y }
      },
      axis: 'h',
      type,
      matchDirection: 'n'
    });
    center.push({
      line: {
        from: { x: node.pos.x, y: node.pos.y + node.size.h },
        to: { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h }
      },
      axis: 'h',
      type,
      matchDirection: 's'
    });
    center.push({
      line: {
        from: { x: node.pos.x, y: node.pos.y },
        to: { x: node.pos.x, y: node.pos.y + node.size.h }
      },
      axis: 'v',
      type,
      matchDirection: 'w'
    });
    center.push({
      line: {
        from: { x: node.pos.x + node.size.w, y: node.pos.y },
        to: { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h }
      },
      axis: 'v',
      type,
      matchDirection: 'e'
    });
    return center;
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

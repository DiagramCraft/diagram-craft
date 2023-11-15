import { Point } from '../geometry/point.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';
import {
  AbstractEdgeDef,
  AbstractNodeDef,
  Diagram,
  ResolvedEdgeDef,
  ResolvedNodeDef
} from './diagram.ts';

interface Reference {
  id: string;
}

export interface SerializedDiagram {
  elements: (SerializedNodeDef | SerializedEdgeDef)[];
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

const isNodeDef = (element: SerializedNodeDef | SerializedEdgeDef): element is SerializedNodeDef =>
  element.type === 'node';

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

export const deserializeDiagram = (diagram: SerializedDiagram): Diagram => {
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
        nodeLookup[child.id].bounds = {
          ...nodeLookup[child.id].bounds,
          pos: Point.add(nodeLookup[child.id].bounds.pos, nodeLookup[child.parent.id].bounds.pos)
        };
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

  return new Diagram(elements);
};

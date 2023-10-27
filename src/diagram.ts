import {Coord} from "./types.ts";

export type NodeDef<EdgeRef = Reference> = {
  type: 'node',
  nodeType: 'group' | string;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  edges?: Record<string, EdgeRef[]>;

  // TODO: Should allow edges as part of group
  children: NodeDef<EdgeRef>[]
};

export type EdgeDef<NodeRef = Reference> = {
  type: 'edge',
  id: string;
  start: { anchor: string, node: NodeRef };
  end: { anchor: string, node: NodeRef };
};



export type ResolvedNodeDef = Omit<NodeDef<ResolvedReference<EdgeDef>>, 'children'> & {
  parent?: ResolvedNodeDef,
  world: Coord
  children: ResolvedNodeDef[]
};

export type ResolvedEdgeDef = EdgeDef<ResolvedReference<ResolvedNodeDef>>;



export type Reference = {
  id: string;
}

export type ResolvedReference<T> = Reference & {
  val: T;
}

export type Diagram = {
  elements: (EdgeDef | NodeDef)[]
}

export type LoadedDiagram = {
  diagram: Diagram,
  nodeLookup: Record<string, ResolvedNodeDef>,
  edgeLookup: Record<string, ResolvedEdgeDef>
}

const makeWorldCoord = (
  n: NodeDef,
  refCoord?: Coord,
) => ({x: (refCoord?.x ?? 0) + n.x, y: (refCoord?.y ?? 0) + n.y});

const enumerateAllNodes = (nodes: NodeDef[], parentId?: string, refCoord?: Coord): (NodeDef & { parentId?: string, world: Coord })[] => {
  return [...nodes.map(n => ({ ...n, parentId,
    world: makeWorldCoord(n, refCoord)
  })), ...nodes.flatMap(n => enumerateAllNodes(n.children, n.id, makeWorldCoord(n, refCoord)))];
};

const isNodeDef = (element: NodeDef | EdgeDef): element is NodeDef => element.type === 'node';

export const loadDiagram = (diagram: Diagram): LoadedDiagram => {
  const nodeLookup: Record<string, ResolvedNodeDef> = {};

  const allNodes = enumerateAllNodes(diagram.elements.filter(isNodeDef));
  for (const n of allNodes) {
    nodeLookup[n.id] = {
      ...n,
      edges: {},
      children: []
    };
  }

  for (const n of allNodes) {
    nodeLookup[n.id].children = n.children.map(c => nodeLookup[c.id]);
    if (n.parentId) {
      nodeLookup[n.id].parent = nodeLookup[n.parentId]
    }
  }

  const edgeLookup: Record<string, ResolvedEdgeDef> = {};
  for (const e of diagram.elements) {
    if (e.type !== 'edge') continue;

    const edge = {
      ...e,
      start: { anchor: e.start.anchor, node: { ...e.start.node, val: nodeLookup[e.start.node.id] } },
      end: { anchor: e.end.anchor, node: { ...e.end.node, val: nodeLookup[e.end.node.id] } },
    };

    const startNode = nodeLookup[edge.start.node.id];

    startNode.edges ??= {};
    startNode.edges![edge.start.anchor] ??= [];
    startNode.edges![edge.start.anchor].push({id: edge.id, val: edge});


    const endNode = nodeLookup[edge.end.node.id];

    endNode.edges ??= {};
    endNode.edges![edge.end.anchor] ??= [];
    endNode.edges![edge.end.anchor].push({id: edge.id, val: edge});

    edgeLookup[e.id] = edge;
  }

  return { diagram, edgeLookup, nodeLookup }
};

export const NodeDef = {
  move: (node: ResolvedNodeDef, newWorldCoord: Coord) => {

    if (! node.parent) {
      const dx = newWorldCoord.x - node.world.x;
      const dy = newWorldCoord.y - node.world.y;

      node.x += dx;
      node.y += dy;
      node.world.x += dx;
      node.world.y += dy;
    } else {
      node.world.x = node.parent.world.x + node.x;
      node.world.y = node.parent.world.y + node.y;
    }

    for (const cn of node.children) {
      NodeDef.move(cn, newWorldCoord);
    }
  },

  edges: (node: ResolvedNodeDef): EdgeDef[] => {
    return [...Object.values(node.edges ?? {}).flatMap(e => e).map(e => e.val), ...node.children.flatMap(c => NodeDef.edges(c))]
  }
};

import { Box, Coord, Extent } from './geometry.ts';

export type NodeDef<EdgeRef = Reference> = {
  type: 'node';
  nodeType: 'group' | string;
  id: string;

  pos: Coord;
  size: Extent;

  edges?: Record<string, EdgeRef[]>;

  // TODO: Should allow edges as part of group
  children: NodeDef<EdgeRef>[];
};

export type EdgeDef<NodeRef = Reference> = {
  type: 'edge';
  id: string;
  start: { anchor: string; node: NodeRef };
  end: { anchor: string; node: NodeRef };
};

export type ResolvedNodeDef = Omit<NodeDef<ResolvedReference<EdgeDef>>, 'children'> & {
  parent?: ResolvedNodeDef;
  world: Coord;
  children: ResolvedNodeDef[];
};

export type ResolvedEdgeDef = EdgeDef<ResolvedReference<ResolvedNodeDef>>;

export type Reference = {
  id: string;
};

export type ResolvedReference<T> = Reference & {
  val: T;
};

export type Diagram = {
  elements: (EdgeDef | NodeDef)[];
};

export type LoadedDiagram = {
  diagram: Diagram;
  nodeLookup: Record<string, ResolvedNodeDef>;
  edgeLookup: Record<string, ResolvedEdgeDef>;
};

const makeWorldCoord = (n: NodeDef, refCoord?: Coord) => ({
  x: (refCoord?.x ?? 0) + n.pos.x,
  y: (refCoord?.y ?? 0) + n.pos.y
});

const enumerateAllNodes = (
  nodes: NodeDef[],
  parentId?: string,
  refCoord?: Coord
): (NodeDef & { parentId?: string; world: Coord })[] => {
  return [
    ...nodes.map(n => ({ ...n, parentId, world: makeWorldCoord(n, refCoord) })),
    ...nodes.flatMap(n => enumerateAllNodes(n.children, n.id, makeWorldCoord(n, refCoord)))
  ];
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
      nodeLookup[n.id].parent = nodeLookup[n.parentId];
    }
  }

  const edgeLookup: Record<string, ResolvedEdgeDef> = {};
  for (const e of diagram.elements) {
    if (e.type !== 'edge') continue;

    const edge = {
      ...e,
      start: {
        anchor: e.start.anchor,
        node: { ...e.start.node, val: nodeLookup[e.start.node.id] }
      },
      end: { anchor: e.end.anchor, node: { ...e.end.node, val: nodeLookup[e.end.node.id] } }
    };

    const startNode = nodeLookup[edge.start.node.id];

    startNode.edges ??= {};
    startNode.edges![edge.start.anchor] ??= [];
    startNode.edges![edge.start.anchor].push({ id: edge.id, val: edge });

    const endNode = nodeLookup[edge.end.node.id];

    endNode.edges ??= {};
    endNode.edges![edge.end.anchor] ??= [];
    endNode.edges![edge.end.anchor].push({ id: edge.id, val: edge });

    edgeLookup[e.id] = edge;
  }

  return { diagram, edgeLookup, nodeLookup };
};

export const NodeDef = {
  move: (node: ResolvedNodeDef, newWorldCoord: Coord) => {
    if (!node.parent) {
      const dx = newWorldCoord.x - node.world.x;
      const dy = newWorldCoord.y - node.world.y;

      node.pos.x += dx;
      node.pos.y += dy;
      node.world.x += dx;
      node.world.y += dy;
    } else {
      node.world.x = node.parent.world.x + node.pos.x;
      node.world.y = node.parent.world.y + node.pos.y;
    }

    for (const cn of node.children) {
      NodeDef.move(cn, newWorldCoord);
    }
  },

  transform: (node: ResolvedNodeDef, before: Box, after: Box) => {
    // Calculate relative position of node within before
    const relX = (node.world.x - before.pos.x) / before.size.w;
    const relY = (node.world.y - before.pos.y) / before.size.h;

    // Calculate relative size of node within before
    const relW = node.size.w / before.size.w;
    const relH = node.size.h / before.size.h;

    // Calculate new position of node within after
    node.world.x = after.pos.x + relX * after.size.w;
    node.world.y = after.pos.y + relY * after.size.h;
    node.pos.x = after.size.w * relX;
    node.pos.y = after.size.h * relY;

    // Calculate new size of node within after
    node.size.w = relW * after.size.w;
    node.size.h = relH * after.size.h;

    for (const cn of node.children) {
      NodeDef.transform(cn, before, after);
    }
  },

  edges: (node: ResolvedNodeDef): EdgeDef[] => {
    return [
      ...Object.values(node.edges ?? {})
        .flatMap(e => e)
        .map(e => e.val),
      ...node.children.flatMap(c => NodeDef.edges(c))
    ];
  }
};

export type NodeDef<EdgeRef = Reference> = {
  type: 'node',
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  edges?: Record<string, EdgeRef[]>;
};

export type EdgeDef<NodeRef = Reference> = {
  type: 'edge',
  id: string;
  start: { anchor: string, node: NodeRef };
  end: { anchor: string, node: NodeRef };
};



export type ResolvedNodeDef = NodeDef<ResolvedReference<EdgeDef>>;
export type ResolvedEdgeDef = EdgeDef<ResolvedReference<NodeDef>>;



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

export const loadDiagram = (diagram: Diagram): LoadedDiagram => {
  const nodeLookup: Record<string, ResolvedNodeDef> = {};
  for (const e of diagram.elements) {
    if (e.type !== 'node') continue;

    nodeLookup[e.id] = {
      ...e,
      edges: {}
    };
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
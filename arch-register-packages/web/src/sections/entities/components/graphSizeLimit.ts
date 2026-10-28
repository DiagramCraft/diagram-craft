/** Above this many nodes plus edges a graph is not drawn: layout and rendering get too slow. */
export const MAX_GRAPH_ELEMENTS = 1000;

export const isGraphTooLarge = (nodeCount: number, edgeCount: number): boolean =>
  nodeCount + edgeCount > MAX_GRAPH_ELEMENTS;

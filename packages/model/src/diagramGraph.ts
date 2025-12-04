import { SimpleGraph } from '@diagram-craft/graph/graph';
import { DiagramNode } from './diagramNode';
import type { DiagramEdge } from './diagramEdge';
import type { RegularLayer } from './diagramLayerRegular';
import { isEdge, isNode } from './diagramElement';
import { ConnectedEndpoint } from './endpoint';

export class DiagramGraph extends SimpleGraph<DiagramNode, DiagramEdge> {
  constructor(layer: RegularLayer) {
    super();

    const nodes = layer.elements.filter(e => isNode(e));
    const edges = layer.elements.filter(e => isEdge(e));

    // Add all nodes as vertices
    for (const node of nodes) {
      this.addVertex({ id: node.id, data: node });
    }

    // Add all edges
    for (const edge of edges) {
      if (edge.start instanceof ConnectedEndpoint && edge.end instanceof ConnectedEndpoint) {
        this.addEdge({
          id: edge.id,
          from: edge.start.node.id,
          to: edge.end.node.id,
          weight: 1,
          data: edge
        });
      }
    }
  }
}

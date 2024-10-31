import { DiagramDocument } from '../diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { Diagram } from '../diagram';
import { UnitOfWork } from '../unitOfWork';
import { RegularLayer } from '../diagramLayer';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramNode } from '../diagramNode';
import { DiagramEdge } from '../diagramEdge';
import { FreeEndpoint } from '../endpoint';

export class DocumentBuilder {
  private document: DiagramDocument;

  constructor() {
    this.document = new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry());
  }

  newDiagram() {
    return new DiagramBuilder(this.document);
  }

  build() {
    return this.document;
  }
}

export class DiagramBuilder extends Diagram {
  constructor(document: DiagramDocument) {
    super('1', '1', document);
  }

  newLayer(id?: string) {
    const layer = new LayerBuilder(id ?? (this.layers.all.length + 1).toString(), this);
    this.layers.add(layer, UnitOfWork.immediate(this));
    return layer;
  }
}

export class LayerBuilder extends RegularLayer {
  constructor(id: string, diagram: Diagram) {
    super(id, id, [], diagram);
  }

  addNode(
    id: string,
    type: string,
    options: {
      bounds?: Box;
    }
  ) {
    const node = new DiagramNode(
      id,
      type,
      options.bounds ?? {
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        r: 0
      },
      this.diagram,
      this,
      {},
      {}
    );
    this.addElement(node, UnitOfWork.immediate(this.diagram));
    return node;
  }

  addEdge(id: string) {
    const edge = new DiagramEdge(
      id,
      new FreeEndpoint({ x: 0, y: 0 }),
      new FreeEndpoint({ x: 100, y: 100 }),
      {},
      {},
      [],
      this.diagram,
      this
    );
    this.addElement(edge, UnitOfWork.immediate(this.diagram));
    return edge;
  }
}

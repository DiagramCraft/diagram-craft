import { DiagramDocument } from '../diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { Diagram } from '../diagram';
import { UnitOfWork } from '../unitOfWork';
import { RegularLayer } from '../diagramLayerRegular';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramNode } from '../diagramNode';
import { DiagramEdge, ResolvedLabelNode } from '../diagramEdge';
import { FreeEndpoint } from '../endpoint';
import { newid } from '@diagram-craft/utils/id';
import { CRDTRoot } from '../collaboration/crdt';

export class TestModel {
  static newDiagram(root?: CRDTRoot) {
    const document = new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry(), false, root);
    const db = new TestDiagramBuilder(document);
    document.addDiagram(db);
    return db;
  }

  static newDiagramWithLayer(root?: CRDTRoot) {
    const document = new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry(), false, root);
    const diagram = new TestDiagramBuilder(document);
    diagram.newLayer();
    document.addDiagram(diagram);
    return diagram;
  }

  static newDocument(root?: CRDTRoot) {
    return new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry(), false, root);
  }
}

export class TestDiagramBuilder extends Diagram {
  constructor(document: DiagramDocument, id = '1') {
    super(id, '1', document);
  }

  newLayer(id?: string) {
    const layer = new TestLayerBuilder(id ?? (this.layers.all.length + 1).toString(), this);
    this.layers.add(layer, UnitOfWork.immediate(this));
    return layer;
  }
}

export class TestLayerBuilder extends RegularLayer {
  constructor(id: string, diagram: Diagram) {
    super(id, id, [], diagram);
  }

  addNode(
    id?: string,
    type?: string,
    options?: {
      bounds?: Box;
    }
  ) {
    const node = this.createNode(id, type, options);
    this.addElement(node, UnitOfWork.immediate(this.diagram));
    return node;
  }

  createNode(
    id?: string,
    type?: string,
    options?: {
      bounds?: Box;
    }
  ) {
    return new TestDiagramNodeBuilder(
      id ?? newid(),
      type ?? 'rect',
      options?.bounds ?? {
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        r: 0
      },
      this.diagram
    );
  }

  addEdge(id?: string) {
    const edge = this.createEdge(id);
    this.addElement(edge, UnitOfWork.immediate(this.diagram));
    return edge;
  }

  createEdge(id?: string) {
    return DiagramEdge.create(
      id ?? newid(),
      new FreeEndpoint({ x: 0, y: 0 }),
      new FreeEndpoint({ x: 100, y: 100 }),
      {},
      {},
      [],
      this
    );
  }
}

export class TestDiagramNodeBuilder extends DiagramNode {
  constructor(id: string, type: string, bounds: Box, diagram: Diagram) {
    super(id, diagram.activeLayer, {});
    DiagramNode.initializeNode(this, type, bounds, {});
  }

  asLabelNode(): ResolvedLabelNode {
    return {
      node: this,
      type: 'perpendicular',
      offset: { x: 0, y: 0 },
      timeOffset: 0,
      id: newid()
    };
  }
}

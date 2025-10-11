import { DiagramDocument } from '../diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { Diagram } from '../diagram';
import { UnitOfWork } from '../unitOfWork';
import { RegularLayer } from '../diagramLayerRegular';
import { Box } from '@diagram-craft/geometry/box';
import { SimpleDiagramNode } from '../diagramNode';
import { ResolvedLabelNode, SimpleDiagramEdge } from '../diagramEdge';
import { FreeEndpoint } from '../endpoint';
import { newid } from '@diagram-craft/utils/id';
import { CRDTRoot } from '../collaboration/crdt';
import { assertRegularLayer } from '../diagramLayerUtils';

export class TestModel {
  static newDiagram(root?: CRDTRoot) {
    const document = TestModel.newDocument(root);
    const db = new TestDiagramBuilder(document);
    document.addDiagram(db);
    return db;
  }

  static newDocument(root?: CRDTRoot) {
    return new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry(), false, root);
  }

  static newDiagramWithLayer(opts?: { root?: CRDTRoot; nodes?: Array<NodeCreateOptions> }) {
    const diagram = TestModel.newDiagram(opts?.root);
    const layer = diagram.newLayer();

    if (opts?.nodes) {
      opts.nodes.forEach(node => layer.addNode(node));
    }

    return { diagram, layer };
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

export type NodeCreateOptions = { id?: string; type?: string; bounds?: Box };
export type EdgeCreateOptions = { id?: string };

export class TestLayerBuilder extends RegularLayer {
  constructor(id: string, diagram: Diagram) {
    super(id, id, [], diagram);
  }

  addNode(options?: NodeCreateOptions) {
    const node = this.createNode(options);
    this.addElement(node, UnitOfWork.immediate(this.diagram));
    return node;
  }

  createNode(options?: NodeCreateOptions) {
    return new TestDiagramNodeBuilder(
      options?.id ?? newid(),
      options?.type ?? 'rect',
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

  addEdge(options?: EdgeCreateOptions) {
    const edge = this.createEdge(options);
    this.addElement(edge, UnitOfWork.immediate(this.diagram));
    return edge;
  }

  createEdge(options?: EdgeCreateOptions) {
    return SimpleDiagramEdge.create(
      options?.id ?? newid(),
      new FreeEndpoint({ x: 0, y: 0 }),
      new FreeEndpoint({ x: 100, y: 100 }),
      {},
      {},
      [],
      this
    );
  }
}

export class TestDiagramNodeBuilder extends SimpleDiagramNode {
  constructor(id: string, type: string, bounds: Box, diagram: Diagram) {
    super(id, diagram.activeLayer as RegularLayer);
    assertRegularLayer(this.layer);
    SimpleDiagramNode.initializeNode(this, type, bounds, {}, {});
  }

  asLabelNode(): ResolvedLabelNode {
    return {
      node: () => this,
      type: 'perpendicular',
      offset: { x: 0, y: 0 },
      timeOffset: 0,
      id: newid()
    };
  }
}

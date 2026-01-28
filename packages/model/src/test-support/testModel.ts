import { DiagramDocument } from '../diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { Diagram } from '../diagram';
import { UnitOfWork } from '../unitOfWork';
import { RegularLayer } from '../diagramLayerRegular';
import { Box } from '@diagram-craft/geometry/box';
import { type DiagramNode, SimpleDiagramNode } from '../diagramNode';
import { ResolvedLabelNode } from '../diagramEdge';
import { AnchorEndpoint, FreeEndpoint } from '../endpoint';
import { newid } from '@diagram-craft/utils/id';
import { assertRegularLayer } from '../diagramLayerUtils';
import { ElementFactory } from '../elementFactory';
import type { CRDTRoot } from '@diagram-craft/collaboration/crdt';
import { Point } from '@diagram-craft/geometry/point';
import type { NodeProps } from '../diagramProps';
import { StencilRegistry } from '@diagram-craft/model/elementDefinitionRegistry';

export class TestModel {
  static newDiagram(root?: CRDTRoot) {
    const document = TestModel.newDocument(root);
    const db = new TestDiagramBuilder(document);
    document.addDiagram(db);
    return db;
  }

  static newDocument(root?: CRDTRoot) {
    const stencilRegistry = new StencilRegistry();
    return new DiagramDocument(
      defaultNodeRegistry(stencilRegistry),
      defaultEdgeRegistry(stencilRegistry),
      false,
      root
    );
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
    UnitOfWork.execute(this, uow => this.layers.add(layer, uow));
    return layer;
  }
}

export type NodeCreateOptions = { id?: string; type?: string; bounds?: Box; props?: NodeProps };
export type EdgeCreateOptions = {
  id?: string;
  startNodeId?: string;
  endNodeId?: string;
  startAnchor?: string;
  endAnchor?: string;
};

export class TestLayerBuilder extends RegularLayer {
  constructor(id: string, diagram: Diagram) {
    super(id, id, [], diagram);
  }

  addNode(options?: NodeCreateOptions) {
    const node = this.createNode(options);
    UnitOfWork.executeSilently(this.diagram, uow => this.addElement(node, uow));
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
      this.diagram,
      options?.props
    );
  }

  addEdge(options?: EdgeCreateOptions) {
    const edge = this.createEdge(options);
    UnitOfWork.execute(this.diagram, uow => this.addElement(edge, uow));
    return edge;
  }

  createEdge(options?: EdgeCreateOptions) {
    const startNode = options?.startNodeId ? this.diagram.lookup(options.startNodeId) : undefined;
    const endNode = options?.endNodeId ? this.diagram.lookup(options.endNodeId) : undefined;

    const start = startNode
      ? new AnchorEndpoint(startNode as DiagramNode, options?.startAnchor ?? 'c', Point.ORIGIN)
      : new FreeEndpoint({ x: 0, y: 0 });

    const end = endNode
      ? new AnchorEndpoint(endNode as DiagramNode, options?.endAnchor ?? 'c', Point.ORIGIN)
      : new FreeEndpoint({ x: 100, y: 100 });

    return ElementFactory.edge(options?.id ?? newid(), start, end, {}, {}, [], this);
  }
}

export class TestDiagramNodeBuilder extends SimpleDiagramNode {
  constructor(id: string, type: string, bounds: Box, diagram: Diagram, props?: NodeProps) {
    super(id, diagram.activeLayer as RegularLayer);
    assertRegularLayer(this.layer);
    this._initializeNode(type, bounds, props ?? {}, {});
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

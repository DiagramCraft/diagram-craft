// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { EdgeEndpointMoveDrag } from './edgeEndpointMoveDrag';
import { DragEvents } from '../dragDropManager';
import type { Context } from '../context';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { CanvasDomHelper } from '../utils/canvasDomHelper';
import {
  AnchorEndpoint,
  FreeEndpoint,
  PointInNodeEndpoint,
  type Endpoint
} from '@diagram-craft/model/endpoint';
import { RectNodeDefinition } from '../node-types/Rect.nodeType';
import type { AttachEdgeContext } from '@diagram-craft/model/elementDefinitionRegistry';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { AnchorHandleDrag } from './anchorHandleDrag';
import { projectToPointHandle } from './anchorHandleDragSource';
import { Point } from '@diagram-craft/geometry/point';
import type { Anchor } from '@diagram-craft/model/anchor';
import type { NodeLinkOptions } from '../context';
import { EdgeTool } from '@diagram-craft/canvas-app/tools/edgeTool';
import { DRAG_DROP_MANAGER, DragDopManager } from '../dragDropManager';

class AbsoluteAttachNodeDefinition extends RectNodeDefinition {
  constructor(type = 'attach-absolute') {
    super(type, 'Attach Absolute');
  }

  onAttachEdge(
    _node: DiagramNode,
    _edge: DiagramEdge,
    endpoint: Endpoint,
    context: AttachEdgeContext
  ): Endpoint | undefined {
    if (context.type !== 'boundary' || !(endpoint instanceof PointInNodeEndpoint)) return endpoint;
    return new PointInNodeEndpoint(endpoint.node, endpoint.ref, endpoint.offset, 'absolute');
  }
}

class RejectAttachNodeDefinition extends RectNodeDefinition {
  constructor(type = 'attach-reject') {
    super(type, 'Attach Reject');
  }

  onAttachEdge(
    _node: DiagramNode,
    _edge: DiagramEdge,
    endpoint: Endpoint,
    context: AttachEdgeContext
  ): Endpoint | undefined {
    return context.type === 'boundary' ? undefined : endpoint;
  }
}

class ReplaceAttachNodeDefinition extends RectNodeDefinition {
  constructor(type = 'attach-replace') {
    super(type, 'Attach Replace');
  }

  onAttachEdge(
    node: DiagramNode,
    _edge: DiagramEdge,
    endpoint: Endpoint,
    context: AttachEdgeContext
  ): Endpoint | undefined {
    return context.type === 'boundary' ? new AnchorEndpoint(node, 'c') : endpoint;
  }
}

class PhaseCaptureNodeDefinition extends RectNodeDefinition {
  phases: AttachEdgeContext['phase'][] = [];

  constructor(type = 'attach-phase-capture') {
    super(type, 'Attach Phase Capture');
  }

  onAttachEdge(
    _node: DiagramNode,
    _edge: DiagramEdge,
    endpoint: Endpoint,
    context: AttachEdgeContext
  ): Endpoint | undefined {
    this.phases.push(context.phase);
    return endpoint;
  }
}

class LinkPopupOptionsNodeDefinition extends RectNodeDefinition {
  constructor(type = 'link-popup-options') {
    super(type, 'Link Popup Options');
  }

  getNodeLinkOptions(): NodeLinkOptions | undefined {
    return {
      nodeStencilIds: ['custom-node', 'default@@rect'],
      edgeStylesheetIds: ['edge-2', 'default-edge'],
      allowedCombinations: [{ nodeStencilId: 'custom-node', edgeStylesheetId: 'edge-2' }]
    };
  }
}

const withEdgeAnchor = (node: DiagramNode) => {
  const anchors = [
    {
      id: 'top-edge',
      type: 'edge',
      start: Point.of(0, 0),
      end: Point.of(1, 0),
      normal: -Math.PI / 2,
      isPrimary: true,
      clip: false
    },
    { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
  ] satisfies Anchor[];

  Object.defineProperty(node, 'anchors', {
    configurable: true,
    get: () => anchors
  });
  node.getAnchor = (anchor: string) => anchors.find(a => a.id === anchor) ?? anchors[0]!;
  return node;
};

const createContext = (): Context =>
  ({
    model: {} as Context['model'],
    ui: {
      showContextMenu: vi.fn(),
      showNodeLinkPopup: vi.fn(),
      showDialog: vi.fn()
    },
    help: {
      set: vi.fn(),
      push: vi.fn(),
      pop: vi.fn()
    },
    tool: {} as Context['tool'],
    actions: {},
    marquee: {} as Context['marquee'],
    actionState: {} as Context['actionState']
  }) as Context;

const mountDiagramElement = (diagramId: string) => {
  const el = document.createElement('div');
  el.id = diagramId;
  document.body.appendChild(el);
  return el;
};

const attachEndToNodeBoundary = (
  nodeType: string,
  extraProps: NodeProps = {},
  setup?: (diagram: ReturnType<typeof TestModel.newDiagramWithLayer>['diagram']) => void
) => {
  const { diagram, layer } = TestModel.newDiagramWithLayer();
  setup?.(diagram);
  mountDiagramElement(CanvasDomHelper.diagramId(diagram));

  const node = layer.addNode({
    type: nodeType,
    bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
    props: {
      anchors: { type: 'none' },
      ...extraProps
    }
  });
  const edge = layer.addEdge();
  UnitOfWork.execute(diagram, uow => {
    edge.setEnd(new FreeEndpoint({ x: 150, y: 50 }), uow);
  });

  const drag = new EdgeEndpointMoveDrag(diagram, edge, 'end', createContext());
  const target = document.createElement('div');
  const point = { x: 100, y: 20 };

  drag.onDragEnter(new DragEvents.DragEnter(point, target, node.id));
  drag.onDrag(
    new DragEvents.DragStart(
      point,
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
      target
    )
  );
  drag.onDragEnd();

  return { edge, node };
};

const dragAcrossNodes = (
  setup?: (diagram: ReturnType<typeof TestModel.newDiagramWithLayer>['diagram']) => void
) => {
  const { diagram, layer } = TestModel.newDiagramWithLayer();
  setup?.(diagram);
  mountDiagramElement(CanvasDomHelper.diagramId(diagram));

  const allowedNode = layer.addNode({
    type: 'rect',
    bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
    props: {
      anchors: { type: 'none' }
    }
  });
  const rejectingNode = layer.addNode({
    type: 'attach-reject',
    bounds: { x: 200, y: 0, w: 100, h: 100, r: 0 },
    props: {
      anchors: { type: 'none' }
    }
  });
  const edge = layer.addEdge();
  UnitOfWork.execute(diagram, uow => {
    edge.setEnd(new FreeEndpoint({ x: 350, y: 50 }), uow);
  });

  const drag = new EdgeEndpointMoveDrag(diagram, edge, 'end', createContext());
  const target = document.createElement('div');
  const firstPoint = { x: 100, y: 20 };
  const secondPoint = { x: 300, y: 20 };

  drag.onDragEnter(new DragEvents.DragEnter(firstPoint, target, allowedNode.id));
  drag.onDrag(
    new DragEvents.DragStart(
      firstPoint,
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
      target
    )
  );
  drag.onDragLeave(new DragEvents.DragLeave(target, allowedNode.id));
  drag.onDragEnter(new DragEvents.DragEnter(secondPoint, target, rejectingNode.id));
  drag.onDrag(
    new DragEvents.DragStart(
      secondPoint,
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
      target
    )
  );
  drag.onDragEnd();

  return { edge };
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('EdgeEndpointMoveDrag', () => {
  test('keeps default boundary attach behavior when the node definition does not override it', () => {
    const { edge } = attachEndToNodeBoundary('rect');

    expect(edge.end).toBeInstanceOf(PointInNodeEndpoint);
    expect((edge.end as PointInNodeEndpoint).offsetType).toBe('relative');
  });

  test('allows node definitions to replace a boundary point-in-node endpoint with absolute offset', () => {
    const { edge } = attachEndToNodeBoundary('attach-absolute', {}, diagram => {
      diagram.document.registry.nodes.register(new AbsoluteAttachNodeDefinition());
    });

    expect(edge.end).toBeInstanceOf(PointInNodeEndpoint);
    expect((edge.end as PointInNodeEndpoint).offsetType).toBe('absolute');
  });

  test('allows node definitions to reject a boundary attach', () => {
    const { edge } = attachEndToNodeBoundary('attach-reject', {}, diagram => {
      diagram.document.registry.nodes.register(new RejectAttachNodeDefinition());
    });

    expect(edge.end).toBeInstanceOf(FreeEndpoint);
    expect(edge.end.position).toEqual({ x: 100, y: 20 });
  });

  test('falls back to the current pointer when a later hover target rejects the attach', () => {
    const { edge } = dragAcrossNodes(diagram => {
      diagram.document.registry.nodes.register(new RejectAttachNodeDefinition());
    });

    expect(edge.end).toBeInstanceOf(FreeEndpoint);
    expect(edge.end.position).toEqual({ x: 300, y: 20 });
  });

  test('allows node definitions to replace a boundary attach with a different endpoint kind', () => {
    const { edge } = attachEndToNodeBoundary('attach-replace', {}, diagram => {
      diagram.document.registry.nodes.register(new ReplaceAttachNodeDefinition());
    });

    expect(edge.end).toBeInstanceOf(AnchorEndpoint);
    expect((edge.end as AnchorEndpoint).anchorId).toBe('c');
  });

  test('delegates onAttachEdge to the selected container shape', () => {
    const { edge } = attachEndToNodeBoundary(
      'container',
      {
        custom: { container: { shape: 'attach-delegated' } }
      },
      diagram => {
        diagram.document.registry.nodes.register(
          new AbsoluteAttachNodeDefinition('attach-delegated')
        );
      }
    );

    expect(edge.end).toBeInstanceOf(PointInNodeEndpoint);
    expect((edge.end as PointInNodeEndpoint).offsetType).toBe('absolute');
  });

  test('passes drag during preview and dragEnd on drag end', () => {
    const definition = new PhaseCaptureNodeDefinition();

    attachEndToNodeBoundary('attach-phase-capture', {}, diagram => {
      diagram.document.registry.nodes.register(definition);
    });

    expect(definition.phases).toContain('drag');
    expect(definition.phases.at(-1)).toBe('dragEnd');
  });

  test('starts anchor-handle drags from a projected edge anchor source', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    mountDiagramElement(CanvasDomHelper.diagramId(diagram));

    const node = withEdgeAnchor(
      layer.addNode({
        type: 'rect',
        bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 }
      })
    );

    const projected = projectToPointHandle(
      node,
      { x: 40, y: 10 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false }
    );

    expect(projected?.type).toBe('edge-anchor');
    if (!projected || projected.type !== 'edge-anchor') throw new Error('Expected edge anchor');

    const drag = new AnchorHandleDrag(node, projected, projected.point, createContext());

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 180, y: 20 },
        { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
        document.createElement('div')
      )
    );
    drag.onDragEnd();

    expect(drag.edge.start).toBeInstanceOf(AnchorEndpoint);
    expect((drag.edge.start as AnchorEndpoint).anchorId).toBe(projected.anchorId);
    expect((drag.edge.start as AnchorEndpoint).offset).toEqual(projected.offset);
  });

  test('starts anchor-handle drags from a synthetic boundary source', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    mountDiagramElement(CanvasDomHelper.diagramId(diagram));

    const node = layer.addNode({
      type: 'rect',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
      props: {
        anchors: { type: 'none' }
      }
    });

    const projected = projectToPointHandle(
      node,
      { x: 50, y: 10 },
      { shiftKey: false, altKey: false, metaKey: true, ctrlKey: false }
    );

    expect(projected?.type).toBe('boundary-point');
    if (!projected || projected.type !== 'boundary-point')
      throw new Error('Expected boundary handle');

    const drag = new AnchorHandleDrag(
      node,
      {
        type: 'boundary-point',
        offset: projected.offset,
        normal: projected.normal,
        point: projected.point
      },
      projected.point,
      createContext()
    );

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 180, y: 20 },
        { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
        document.createElement('div')
      )
    );
    drag.onDragEnd();

    expect(drag.edge.start).toBeInstanceOf(PointInNodeEndpoint);
    expect((drag.edge.start as PointInNodeEndpoint).offset).toEqual(projected.offset);
  });

  test('short drag from a projected edge anchor still creates a linked node', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    mountDiagramElement(CanvasDomHelper.diagramId(diagram));

    const node = withEdgeAnchor(
      layer.addNode({
        type: 'rect',
        bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 }
      })
    );

    const projected = projectToPointHandle(
      node,
      { x: 40, y: 10 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false }
    );
    if (!projected || projected.type !== 'edge-anchor') throw new Error('Expected edge anchor');

    const drag = new AnchorHandleDrag(node, projected, projected.point, createContext());

    drag.onDragEnd();

    const createdEdge = layer.elements.find(
      element => element !== drag.edge && 'start' in element && 'end' in element
    ) as DiagramEdge | undefined;
    const createdNode = layer.elements.find(
      element => element !== node && 'nodeType' in element
    ) as DiagramNode | undefined;

    expect(createdEdge?.start).toBeInstanceOf(AnchorEndpoint);
    expect(createdNode?.bounds.y).toBeLessThan(node.bounds.y);
  });

  test('short drag from a synthetic boundary source still creates a linked node', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    mountDiagramElement(CanvasDomHelper.diagramId(diagram));

    const node = layer.addNode({
      type: 'rect',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
      props: {
        anchors: { type: 'none' }
      }
    });

    const projected = projectToPointHandle(
      node,
      { x: 50, y: 10 },
      { shiftKey: false, altKey: false, metaKey: true, ctrlKey: false }
    );
    if (!projected || projected.type !== 'boundary-point')
      throw new Error('Expected boundary handle');

    const drag = new AnchorHandleDrag(
      node,
      {
        type: 'boundary-point',
        offset: projected.offset,
        normal: projected.normal,
        point: projected.point
      },
      projected.point,
      createContext()
    );

    drag.onDragEnd();

    const createdEdge = layer.elements.find(
      element => element !== drag.edge && 'start' in element && 'end' in element
    ) as DiagramEdge | undefined;
    const createdNode = layer.elements.find(
      element => element !== node && 'nodeType' in element
    ) as DiagramNode | undefined;

    expect(createdEdge?.start).toBeInstanceOf(PointInNodeEndpoint);
    expect(createdNode?.bounds.y).toBeLessThan(node.bounds.y);
  });

  test('passes source node link popup options from anchor-handle drags', () => {
    const context = createContext();
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    mountDiagramElement(CanvasDomHelper.diagramId(diagram));
    diagram.document.registry.nodes.register(new LinkPopupOptionsNodeDefinition());

    const node = layer.addNode({
      type: 'link-popup-options',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 }
    });

    const drag = new AnchorHandleDrag(
      node,
      { type: 'anchor', anchorId: 'c', normal: 0, point: { x: 50, y: 50 } },
      { x: 50, y: 50 },
      context
    );

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 180, y: 20 },
        { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false },
        document.createElement('div')
      )
    );
    drag.onDragEnd();

    expect(context.ui.showNodeLinkPopup).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      drag.edge.id,
      expect.any(Array),
      {
        nodeStencilIds: ['custom-node', 'default@@rect'],
        edgeStylesheetIds: ['edge-2', 'default-edge'],
        allowedCombinations: [{ nodeStencilId: 'custom-node', edgeStylesheetId: 'edge-2' }]
      }
    );
  });

  test('passes source node link popup options from shift-drag edge tool flows', () => {
    vi.useFakeTimers();

    const context = createContext();
    const dragManager = new DragDopManager();
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    mountDiagramElement(CanvasDomHelper.diagramId(diagram));
    diagram.document.registry.nodes.register(new LinkPopupOptionsNodeDefinition());

    const node = layer.addNode({
      type: 'link-popup-options',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 }
    });

    const tool = new EdgeTool(diagram, dragManager, null, context, vi.fn());
    const target = document.createElement('div');

    tool.onMouseOver(node.id, { x: 50, y: 50 }, target);
    tool.onMouseMove(
      { x: 50, y: 50 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false }
    );
    tool.onMouseDown(
      node.id,
      { x: 50, y: 50 },
      { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false }
    );

    const drag = DRAG_DROP_MANAGER.current();
    expect(drag).toBeDefined();
    if (!drag) throw new Error('Expected active drag');

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 180, y: 20 },
        { shiftKey: true, altKey: false, metaKey: false, ctrlKey: false },
        target
      )
    );
    drag.onDragEnd(new DragEvents.DragEnd(target));
    vi.runAllTimers();

    expect(context.ui.showNodeLinkPopup).toHaveBeenCalledWith(
      { x: 180, y: 20 },
      expect.any(String),
      expect.any(String),
      expect.any(Array),
      {
        nodeStencilIds: ['custom-node', 'default@@rect'],
        edgeStylesheetIds: ['edge-2', 'default-edge'],
        allowedCombinations: [{ nodeStencilId: 'custom-node', edgeStylesheetId: 'edge-2' }]
      }
    );
  });
});

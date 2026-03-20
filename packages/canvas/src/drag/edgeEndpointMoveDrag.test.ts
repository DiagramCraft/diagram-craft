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
    if (context.mode !== 'boundary' || !(endpoint instanceof PointInNodeEndpoint)) return endpoint;
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
    return context.mode === 'boundary' ? undefined : endpoint;
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
    return context.mode === 'boundary' ? new AnchorEndpoint(node, 'c') : endpoint;
  }
}

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
  drag.onDragLeave(new DragEvents.DragLeave(firstPoint, target, allowedNode.id));
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
        diagram.document.registry.nodes.register(new AbsoluteAttachNodeDefinition('attach-delegated'));
      }
    );

    expect(edge.end).toBeInstanceOf(PointInNodeEndpoint);
    expect((edge.end as PointInNodeEndpoint).offsetType).toBe('absolute');
  });
});

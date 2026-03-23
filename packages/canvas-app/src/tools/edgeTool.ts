import { AbstractTool } from '@diagram-craft/canvas/tool';
import { Point } from '@diagram-craft/geometry/point';
import {
  DRAG_DROP_MANAGER,
  DragDopManager,
  Modifiers
} from '@diagram-craft/canvas/dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { AnchorEndpoint, ConnectedEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import {
  addHighlight,
  getHighlights,
  Highlights,
  removeHighlight
} from '@diagram-craft/canvas/highlight';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Anchor, getAnchorPosition, getClosestAnchor } from '@diagram-craft/model/anchor';
import { EdgeEndpointMoveDrag } from '@diagram-craft/canvas/drag/edgeEndpointMoveDrag';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { Context } from '@diagram-craft/canvas/context';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { createProvisionalLinkedNode } from '@diagram-craft/canvas/linkedNode';

class EdgeToolEdgeEndpointMoveDrag extends EdgeEndpointMoveDrag {
  onDragEnd() {
    super.onDragEnd();

    let popupState:
      | {
          point: Point;
          nodeId: string;
          mode: 'mixed' | 'edges-only';
        }
      | undefined;

    // Only if holding shift and not being over an element
    if (this.modifiers?.shiftKey && this.hoverElement === undefined) {
      // TODO: Guard the free-start case here. EdgeTool can still start from empty canvas,
      //       so this cast is unsafe when shift-dragging from a non-connected start point.
      const start = mustExist(this.edge.start as ConnectedEndpoint);
      const newNode = createProvisionalLinkedNode(start.node, this.edge, this.point!);
      const point = this.point!;
      const nodeId = newNode.id;

      // Base UI popover dismissal still considers the current pointer interaction active.
      // Delaying to the next macrotask avoids immediate outside-press dismissal.
      popupState = { point, nodeId, mode: 'mixed' };
    } else if (this.modifiers?.shiftKey && this.edge.end.isConnected) {
      popupState = { point: this.edge.end.position, nodeId: '', mode: 'edges-only' };
    }

    const undoManager = this.edge.diagram.undoManager;
    undoManager.add(new CompoundUndoableAction([...undoManager.getToMark()]));

    if (popupState) {
      const undoDepth = undoManager.undoableActions.length - 1;

      // Base UI popover dismissal still considers the current pointer interaction active.
      // Delaying to the next macrotask avoids immediate outside-press dismissal.
      setTimeout(() => {
        this.context.ui.showNodeLinkPopup(
          popupState.point,
          popupState.nodeId,
          this.edge.id,
          popupState.mode,
          undoDepth
        );
      }, 0);
    }
  }
}

export class EdgeTool extends AbstractTool {
  private currentAnchor: Anchor | undefined = undefined;
  private edge: DiagramEdge | undefined = undefined;

  constructor(
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    context: Context,
    resetTool: () => void
  ) {
    super('edge', diagram, drag, svg, context, resetTool);

    assertRegularLayer(diagram.activeLayer);
    context.help.set('Click to add edge');
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    const undoManager = this.diagram.undoManager;

    undoManager.setMark();

    const layer = this.diagram.activeLayer;
    assertRegularLayer(layer);

    this.edge = ElementFactory.edge({
      start: this.currentAnchor
        ? new AnchorEndpoint(
            this.diagram.lookup(this.currentElement!) as DiagramNode,
            this.currentAnchor.id
          )
        : new FreeEndpoint(this.diagram.viewBox.toDiagramPoint(point)),
      end: new FreeEndpoint(this.diagram.viewBox.toDiagramPoint(point)),
      metadata: {
        style: this.diagram.document.styles.activeEdgeStylesheet.id
      },
      layer
    });

    UnitOfWork.executeWithUndo(this.diagram, 'Add edge', uow => {
      layer.addElement(this.edge!, uow);
      uow.select(this.diagram, [this.edge!]);
    });

    this.resetTool();

    const drag = new EdgeToolEdgeEndpointMoveDrag(this.diagram, this.edge, 'end', this.context);

    DRAG_DROP_MANAGER.initiate(drag, () => {
      const edge = this.edge;
      assert.present(edge);

      if (this.currentElement) {
        removeHighlight(this.diagram.lookup(this.currentElement), Highlights.NODE__EDGE_CONNECT);
      }
      if (Point.distance(edge.end.position, edge.start.position) < 5) {
        UnitOfWork.execute(this.diagram, uow => {
          edge.setEnd(
            new FreeEndpoint({
              x: edge.start.position.x + 10,
              y: edge.start.position.y + 10
            }),
            uow
          );
        });
      }
    });
  }

  onMouseOver(id: string, point: Point, target: EventTarget) {
    super.onMouseOver(id, point, target);

    const el = this.diagram.lookup(id)!;

    if (isNode(el)) {
      el.anchors; // This looks like a noop, but it will trigger the anchors to be calculated

      addHighlight(el, Highlights.NODE__EDGE_CONNECT);
    }
  }

  onMouseOut(id: string, _point: Point, target: EventTarget) {
    if (this.currentElement) {
      const el = this.diagram.lookup(this.currentElement);
      removeHighlight(el, Highlights.NODE__EDGE_CONNECT);
      for (const h of getHighlights(el)) {
        if (h.startsWith(Highlights.NODE__ACTIVE_ANCHOR)) {
          removeHighlight(el, h);
        }
      }
    }
    super.onMouseOut(id, _point, target);
  }

  onMouseUp(_point: Point, _modifiers: Modifiers) {
    // Do nothing
  }

  onMouseMove(point: Point, _modifiers: Modifiers) {
    if (this.currentAnchor && this.currentElement) {
      removeHighlight(this.diagram.lookup(this.currentElement), Highlights.NODE__ACTIVE_ANCHOR);
    }

    this.currentAnchor = undefined;
    if (!this.currentElement) return;

    const el = this.diagram.lookup(this.currentElement)!;
    if (isNode(el)) {
      const dp = this.diagram.viewBox.toDiagramPoint(point);

      const closestAnchor = getClosestAnchor(dp, el, false);
      if (!closestAnchor) return;

      // TODO: Support boundary endpoints
      if (!closestAnchor.anchor) return;

      const anchorPos = getAnchorPosition(el, closestAnchor.anchor);

      const distance = Point.distance(anchorPos, dp);
      if (distance < 25) {
        this.currentAnchor = closestAnchor.anchor;

        addHighlight(el, Highlights.NODE__ACTIVE_ANCHOR, this.currentAnchor.id);
      }
    }
  }
}

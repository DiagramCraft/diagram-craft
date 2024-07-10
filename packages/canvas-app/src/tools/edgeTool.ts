import { AbstractTool } from '@diagram-craft/canvas/tool';
import { ApplicationTriggers } from '@diagram-craft/canvas/EditableCanvasComponent';
import { Point } from '@diagram-craft/geometry/point';
import {
  DRAG_DROP_MANAGER,
  DragDopManager,
  Modifiers
} from '@diagram-craft/canvas/dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { ConnectedEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { newid } from '@diagram-craft/utils/id';
import { addHighlight, getHighlights, removeHighlight } from '@diagram-craft/canvas/highlight';
import { isNode } from '@diagram-craft/model/diagramElement';
import { getAnchorPosition, getClosestAnchor } from '@diagram-craft/model/anchor';
import { Anchor } from '@diagram-craft/model/anchor';
import { EdgeEndpointMoveDrag } from '@diagram-craft/canvas/drag/edgeEndpointMoveDrag';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

declare global {
  interface Tools {
    edge: EdgeTool;
  }
}

const EDGE_HIGHLIGHT = 'edge-connect';

export class EdgeTool extends AbstractTool {
  private currentAnchor: Anchor | undefined = undefined;

  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svg: SVGSVGElement | null,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('edge', diagram, drag, svg, applicationTriggers, resetTool);

    applicationTriggers.setHelp?.('Click to add edge');
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    const nd = new DiagramEdge(
      newid(),
      this.currentAnchor
        ? new ConnectedEndpoint(
            this.currentAnchor.id,
            this.diagram.lookup(this.currentElement!) as DiagramNode
          )
        : new FreeEndpoint(this.diagram.viewBox.toDiagramPoint(point)),
      new FreeEndpoint(this.diagram.viewBox.toDiagramPoint(point)),
      {},
      [],
      this.diagram,
      this.diagram.layers.active
    );

    this.diagram.undoManager.addAndExecute(
      new ElementAddUndoableAction([nd], this.diagram, 'Add edge')
    );

    this.diagram.selectionState.clear();
    this.diagram.selectionState.toggle(nd);

    this.resetTool();
    DRAG_DROP_MANAGER.initiate(
      new EdgeEndpointMoveDrag(this.diagram, nd, 'end', this.applicationTriggers),
      () => {
        if (this.currentElement) {
          removeHighlight(this.diagram.lookup(this.currentElement!), EDGE_HIGHLIGHT);
        }
        if (Point.distance(nd.end.position, nd.start.position) < 5) {
          nd.setEnd(
            new FreeEndpoint({
              x: nd.start.position.x + 10,
              y: nd.start.position.y + 10
            }),
            UnitOfWork.immediate(this.diagram)
          );
        }
      }
    );
  }

  onMouseOver(id: string, point: Point) {
    super.onMouseOver(id, point);

    const el = this.diagram.lookup(id)!;

    if (isNode(el)) {
      el.anchors; // This looks like a noop, but it will trigger the anchors to be calculated

      addHighlight(el, EDGE_HIGHLIGHT);
    }
  }

  onMouseOut(id: string, _point: Point) {
    if (this.currentElement) {
      const el = this.diagram.lookup(this.currentElement);
      removeHighlight(el, EDGE_HIGHLIGHT);
      for (const h of getHighlights(el)) {
        if (h.startsWith('anchor-')) {
          removeHighlight(el, h);
        }
      }
    }
    super.onMouseOut(id, _point);
  }

  onMouseUp(_point: Point) {
    // Do nothing
  }

  onMouseMove(point: Point, _modifiers: Modifiers) {
    if (this.currentAnchor && this.currentElement) {
      removeHighlight(this.diagram.lookup(this.currentElement), `anchor-${this.currentAnchor.id}`);
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

        addHighlight(el, `anchor-${this.currentAnchor.id}`);
      }
    }
  }
}

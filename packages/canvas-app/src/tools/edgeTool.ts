import { AbstractTool } from '@diagram-craft/canvas/tool';
import { ApplicationTriggers } from '@diagram-craft/canvas/EditableCanvasComponent';
import { Point } from '@diagram-craft/geometry/point';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { newid } from '@diagram-craft/utils/id';
import { addHighlight, removeHighlight } from '@diagram-craft/canvas/highlight';
import { isNode } from '@diagram-craft/model/diagramElement';
import { getAnchorPosition, getClosestAnchor } from '@diagram-craft/model/anchor';
import { Anchor } from '@diagram-craft/model/types';

declare global {
  interface Tools {
    edge: EdgeTool;
  }
}

const EDGE_HIGHLIGHT = 'edge-connect';

export class EdgeTool extends AbstractTool {
  // @ts-ignore
  private currentAnchor: Anchor | undefined = undefined;

  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svg: SVGSVGElement | null,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('edge', diagram, drag, svg, applicationTriggers, resetTool);
    if (this.svg) this.svg.style.cursor = 'crosshair';

    applicationTriggers.setHelp?.('Click to add edge');
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    const nd = new DiagramEdge(
      newid(),
      new FreeEndpoint(this.diagram.viewBox.toDiagramPoint(point)),
      new FreeEndpoint(Point.add(this.diagram.viewBox.toDiagramPoint(point), { x: 50, y: 50 })),
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
      removeHighlight(this.diagram.lookup(this.currentElement), EDGE_HIGHLIGHT);
    }
    super.onMouseOut(id, _point);
  }

  onMouseUp(_point: Point) {
    // Do nothing
  }

  onMouseMove(point: Point, _modifiers: Modifiers) {
    this.currentAnchor = undefined;

    if (!this.currentElement) return;

    const el = this.diagram.lookup(this.currentElement)!;
    if (isNode(el)) {
      const dp = this.diagram.viewBox.toDiagramPoint(point);

      const closestAnchor = getClosestAnchor(dp, el);
      const anchorPos = getAnchorPosition(el, closestAnchor);

      const distance = Point.distance(anchorPos, dp);
      if (distance < 5) {
        this.currentAnchor = closestAnchor;
        //console.log(distance);
      }
    }
  }
}

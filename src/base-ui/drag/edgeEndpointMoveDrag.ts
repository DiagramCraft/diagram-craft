import { Drag } from '../drag.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DiagramEdge } from '../../model-viewer/diagram.ts';
import { Point } from '../../geometry/point.ts';
import { precondition } from '../../utils/assert.ts';

export class EdgeEndpointMoveDrag implements Drag {
  private readonly originalPointerEvents: string;
  private hoverElement: string | undefined;
  private coord: Point | undefined;

  constructor(
    private readonly diagram: EditableDiagram,
    private readonly edge: DiagramEdge,
    private readonly element: SVGElement,
    private readonly type: 'start' | 'end'
  ) {
    this.originalPointerEvents = element.getAttribute('pointer-events') ?? 'all';
    element.classList.add('selection-edge-handle--active');

    // TODO: Should disable point-events on all elements that makes up the edge
    element.setAttribute('pointer-events', 'none');
  }

  onDragEnter(id: string): void {
    this.hoverElement = id;

    if (id && this.diagram.nodeLookup[id]) {
      const el = this.diagram.nodeLookup[id];
      el.anchors;
    }

    const el = this.diagram.nodeLookup[id] || this.diagram.edgeLookup[id];
    this.diagram.addHighlight(el, 'edge-connect');
  }

  onDragLeave(): void {
    if (this.hoverElement) {
      this.diagram.removeHighlight(
        this.diagram.nodeLookup[this.hoverElement] || this.diagram.edgeLookup[this.hoverElement],
        'edge-connect'
      );
    }
    this.hoverElement = undefined;
  }

  onDrag(coord: Point, diagram: EditableDiagram) {
    const selection = diagram.selectionState;
    precondition.is.true(this.type === 'start' || this.type === 'end');

    selection.guides = [];

    if (this.type === 'start') {
      this.edge.start = { position: coord };
    } else {
      this.edge.end = { position: coord };
    }

    this.coord = coord;

    // TODO: We should snap to the connection point
    if (this.hoverElement && diagram.nodeLookup[this.hoverElement]) {
      this.element.classList.add('selection-edge-handle--connected');

      this.attachToClosestAnchor(coord);
    } else {
      this.element.classList.remove('selection-edge-handle--connected');
    }

    diagram.updateElement(this.edge);
    selection.recalculateBoundingBox();
  }

  onDragEnd(_coord: Point, _diagram: EditableDiagram): void {
    this.element.setAttribute('pointer-events', this.originalPointerEvents);
    this.element.classList.remove('selection-edge-handle--active');

    // Using the last known coordinate, attach to the closest anchor
    this.attachToClosestAnchor(this.coord!);

    if (this.hoverElement) {
      this.diagram.removeHighlight(
        this.diagram.nodeLookup[this.hoverElement] || this.diagram.edgeLookup[this.hoverElement],
        'edge-connect'
      );
    }

    // TODO: Create undoable action
  }

  private attachToClosestAnchor(coord: Point) {
    if (this.hoverElement && this.diagram.nodeLookup[this.hoverElement]) {
      if (this.type === 'start') {
        this.edge.start = {
          node: this.diagram.nodeLookup[this.hoverElement],
          anchor: this.getClosestAnchor(coord)
        };
      } else {
        this.edge.end = {
          node: this.diagram.nodeLookup[this.hoverElement],
          anchor: this.getClosestAnchor(coord)
        };
      }
    }
  }

  private getClosestAnchor(coord: Point): number {
    const node = this.diagram.nodeLookup[this.hoverElement!];
    const anchors = node.anchors.map((a, idx) => {
      return {
        idx,
        x: node.bounds.pos.x + a.point.x * node.bounds.size.w,
        y: node.bounds.pos.y + a.point.y * node.bounds.size.h
      };
    });

    let closestAnchor = 0;
    let closestDistance = Number.MAX_SAFE_INTEGER;
    for (const a of anchors) {
      const d = Point.squareDistance(coord, a);
      if (d < closestDistance) {
        closestAnchor = a.idx;
        closestDistance = d;
      }
    }

    return closestAnchor;
  }
}

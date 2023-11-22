import { Drag } from '../drag.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DiagramEdge } from '../../model-viewer/diagram.ts';
import { svgPathProperties } from 'svg-path-properties';
import { Point } from '../../geometry/point.ts';
import { precondition } from '../../utils/assert.ts';

export class EdgeEndpointMoveDrag implements Drag {
  private readonly originalPointerEvents: string;
  private hoverElement: string | undefined;

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
      const g = document.getElementById(`node-${id}`);
      if (g) {
        const boundary = g.querySelectorAll('.node-boundary');
        boundary.forEach(b => {
          if (b instanceof SVGPathElement) {
            for (const p of new svgPathProperties(b.getAttribute('d') ?? '').getParts()) {
              const { x, y } = p.getPointAtLength(p.length / 2);
              const lx = (x - el.bounds.pos.x) / el.bounds.size.w;
              const ly = (y - el.bounds.pos.y) / el.bounds.size.h;

              console.log(lx, ly);
            }
          }
        });
      }
    }

    this.diagram.addHighlight(
      this.diagram.nodeLookup[id] || this.diagram.edgeLookup[id],
      'edge-connect'
    );
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

    // TODO: We should snap to the connection point
    if (this.hoverElement && diagram.nodeLookup[this.hoverElement]) {
      this.element.classList.add('selection-edge-handle--connected');

      this.attachToClosestEdge(diagram);
    } else {
      this.element.classList.remove('selection-edge-handle--connected');
    }

    diagram.updateElement(this.edge);
    selection.recalculateBoundingBox();
  }

  onDragEnd(_coord: Point, diagram: EditableDiagram): void {
    this.element.setAttribute('pointer-events', this.originalPointerEvents);
    this.element.classList.remove('selection-edge-handle--active');

    this.attachToClosestEdge(diagram);

    if (this.hoverElement) {
      this.diagram.removeHighlight(
        this.diagram.nodeLookup[this.hoverElement] || this.diagram.edgeLookup[this.hoverElement],
        'edge-connect'
      );
    }

    // TODO: Create undoable action
  }

  private attachToClosestEdge(diagram: EditableDiagram) {
    if (this.hoverElement && diagram.nodeLookup[this.hoverElement]) {
      if (this.type === 'start') {
        this.edge.start = { node: diagram.nodeLookup[this.hoverElement], anchor: 'center' };
      } else {
        this.edge.end = { node: diagram.nodeLookup[this.hoverElement], anchor: 'center' };
      }
    }
  }
}

import { EventHelper } from '@diagram-craft/utils';
import { DRAG_DROP_MANAGER } from '../dragDropManager.ts';
import { Diagram } from '@diagram-craft/model';
import { Component } from '../component/component.ts';
import * as svg from '../component/vdom-svg.ts';
import { Box, Point } from '@diagram-craft/geometry';
import { ResizeDrag, ResizeType } from '../drag/resizeDrag.ts';

type Props = {
  diagram: Diagram;
};

const HANDLE_RADIUS = 6;

export class ResizeHandlesComponent extends Component<Props> {
  private makeHandle(
    point: Point,
    cursor: ResizeType,
    onMouseDown: (type: ResizeType) => (e: MouseEvent) => void
  ) {
    return svg.rect({
      x: point.x - HANDLE_RADIUS / 2,
      y: point.y - HANDLE_RADIUS / 2,
      width: HANDLE_RADIUS,
      height: HANDLE_RADIUS,
      rx: 1,
      ry: 1,
      class: 'svg-selection__handle',
      cursor: `${cursor}-resize`,
      on: {
        mousedown: onMouseDown(cursor)
      }
    });
  }

  render(props: Props) {
    const diagram = props.diagram;
    const selection = diagram.selectionState;
    const drag = DRAG_DROP_MANAGER;

    const bounds = selection.bounds;

    const points: Point[] = Box.corners({ ...bounds, r: 0 });

    const north = Point.midpoint(points[0], points[1]);
    const east = Point.midpoint(points[1], points[2]);
    const south = Point.midpoint(points[2], points[3]);
    const west = Point.midpoint(points[3], points[0]);

    const makeDragInitiation = (type: ResizeType) => (e: MouseEvent) => {
      if (e.button !== 0) return;
      drag.initiate(
        new ResizeDrag(diagram, type, diagram.viewBox.toDiagramPoint(EventHelper.point(e)))
      );
      e.stopPropagation();
    };

    return svg.g(
      {},
      this.makeHandle(points[0], 'nw', makeDragInitiation),
      this.makeHandle(points[1], 'ne', makeDragInitiation),
      this.makeHandle(points[2], 'se', makeDragInitiation),
      this.makeHandle(points[3], 'sw', makeDragInitiation),
      this.makeHandle(north, 'n', makeDragInitiation),
      this.makeHandle(east, 'e', makeDragInitiation),
      this.makeHandle(south, 's', makeDragInitiation),
      this.makeHandle(west, 'w', makeDragInitiation)
    );
  }
}

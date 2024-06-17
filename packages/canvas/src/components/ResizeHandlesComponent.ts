import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { ResizeDrag, ResizeType } from '../drag/resizeDrag';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { VNode } from '../component/vdom';

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
    const { diagram } = props;

    const selection = diagram.selectionState;
    const bounds = selection.bounds;

    const resizeableVertically = selection.nodes.every(
      p => p.renderProps.capabilities.resizable.vertical !== false
    );
    const resizeableHorizontally = selection.nodes.every(
      p => p.renderProps.capabilities.resizable.horizontal !== false
    );

    const points: Point[] = Box.corners({ ...bounds, r: 0 });

    const north = Point.midpoint(points[0], points[1]);
    const east = Point.midpoint(points[1], points[2]);
    const south = Point.midpoint(points[2], points[3]);
    const west = Point.midpoint(points[3], points[0]);

    const makeDragInitiation = (type: ResizeType) => (e: MouseEvent) => {
      if (e.button !== 0) return;
      DRAG_DROP_MANAGER.initiate(
        new ResizeDrag(diagram, type, diagram.viewBox.toDiagramPoint(EventHelper.point(e)))
      );
      e.stopPropagation();
    };

    const handles: VNode[] = [];

    if (resizeableVertically && resizeableHorizontally) {
      handles.push(
        this.makeHandle(points[0], 'nw', makeDragInitiation),
        this.makeHandle(points[1], 'ne', makeDragInitiation),
        this.makeHandle(points[2], 'se', makeDragInitiation),
        this.makeHandle(points[3], 'sw', makeDragInitiation)
      );
    }

    if (resizeableVertically) {
      handles.push(
        this.makeHandle(south, 's', makeDragInitiation),
        this.makeHandle(north, 'n', makeDragInitiation)
      );
    }

    if (resizeableHorizontally) {
      handles.push(
        this.makeHandle(west, 'w', makeDragInitiation),
        this.makeHandle(east, 'e', makeDragInitiation)
      );
    }

    return svg.g({}, ...handles);
  }
}

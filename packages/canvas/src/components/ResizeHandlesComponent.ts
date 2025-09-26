import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { ResizeDrag, ResizeType } from '../drag/resizeDrag';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { VNode } from '../component/vdom';
import { Zoom } from './zoom';

type Props = {
  diagram: Diagram;
};

const HANDLE_RADIUS = 6;
const MIN_DIM = 3;

export class ResizeHandlesComponent extends Component<Props> {
  private makeHandle(
    point: Point,
    cursor: ResizeType,
    onMouseDown: (type: ResizeType) => (e: MouseEvent) => void,
    z: Zoom
  ) {
    return svg.rect({
      x: point.x - z.num(HANDLE_RADIUS / 2, MIN_DIM / 2),
      y: point.y - z.num(HANDLE_RADIUS / 2, MIN_DIM / 2),
      width: z.str(HANDLE_RADIUS, MIN_DIM),
      height: z.str(HANDLE_RADIUS, MIN_DIM),
      rx: z.str(1),
      ry: z.str(1),
      class: 'svg-handle svg-selection__handle',
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

    const points = Box.corners({ ...bounds, r: 0 });

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

    const z = new Zoom(diagram.viewBox.zoomLevel);

    if (resizeableVertically && resizeableHorizontally) {
      handles.push(
        this.makeHandle(points[0], 'nw', makeDragInitiation, z),
        this.makeHandle(points[1], 'ne', makeDragInitiation, z),
        this.makeHandle(points[2], 'se', makeDragInitiation, z),
        this.makeHandle(points[3], 'sw', makeDragInitiation, z)
      );
    }

    if (resizeableVertically) {
      handles.push(
        this.makeHandle(south, 's', makeDragInitiation, z),
        this.makeHandle(north, 'n', makeDragInitiation, z)
      );
    }

    if (resizeableHorizontally) {
      handles.push(
        this.makeHandle(west, 'w', makeDragInitiation, z),
        this.makeHandle(east, 'e', makeDragInitiation, z)
      );
    }

    return svg.g({}, ...handles);
  }
}

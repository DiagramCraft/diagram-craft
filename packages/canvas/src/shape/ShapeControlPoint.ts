import * as svg from '../component/vdom-svg';
import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { ShapeControlPointDrag } from '../drag/shapeControlPointDrag';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Zoom } from '../components/zoom';

export type ControlPointCallback = (p: Point, uow: UnitOfWork) => string;

export type ControlPoint = {
  x: number;
  y: number;
  cb: ControlPointCallback;
};

export const makeControlPoint = (cp: ControlPoint, element: DiagramElement) => {
  const z = new Zoom(element.diagram.viewBox.zoomLevel);
  return svg.circle({
    class: 'svg-handle svg-shape-control-point',
    cx: cp.x,
    cy: cp.y,
    r: z.str(3, 1.5),
    on: {
      mousedown: (e: MouseEvent) => {
        if (e.button !== 0) return;
        DRAG_DROP_MANAGER.initiate(new ShapeControlPointDrag(element, cp.cb));
        e.stopPropagation();
      }
    }
  });
};

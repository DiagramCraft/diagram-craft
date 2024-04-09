import { DiagramNode, UnitOfWork } from '@diagram-craft/model';
import * as svg from '../component/vdom-svg.ts';
import { DRAG_DROP_MANAGER } from '../DragDropManager.ts';
import { ShapeControlPointDrag } from '../drag/shapeControlDrag.ts';

export type ControlPointCallback = (x: number, y: number, uow: UnitOfWork) => string;

export type ControlPoint = {
  x: number;
  y: number;
  cb: ControlPointCallback;
};

export const makeControlPoint = (cp: ControlPoint, node: DiagramNode) => {
  return svg.circle({
    class: 'svg-shape-control-point',
    cx: cp.x,
    cy: cp.y,
    r: '4',
    on: {
      mousedown: (e: MouseEvent) => {
        if (e.button !== 0) return;
        DRAG_DROP_MANAGER.initiate(new ShapeControlPointDrag(node, cp.cb));
        e.stopPropagation();
      }
    }
  });
};

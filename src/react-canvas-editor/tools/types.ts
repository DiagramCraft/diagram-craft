import { Point } from '../../geometry/point.ts';
import { DragDopManager, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { MutableRefObject, RefObject } from 'react';
import { Diagram } from '../../model/diagram.ts';

export type ToolType = 'move' | 'text';

export interface Tool {
  onMouseDown(id: ObjectId, point: Point, modifiers: Modifiers): void;

  onMouseUp(point: Point): void;

  onMouseMove(point: Point, modifiers: Modifiers): void;
}

export type ToolContructor = {
  new (
    diagram: Diagram,
    drag: DragDopManager,
    svgRef: RefObject<SVGSVGElement>,
    deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    resetTool: () => void
  ): Tool;
};

// TODO: Move this constant somewhere else
export const BACKGROUND = 'background';

export type ObjectId = typeof BACKGROUND | string;

// TODO: Potentially move this to a more general place
export type DeferedMouseAction = {
  callback: () => void;
};

import { Point } from '../../geometry/point.ts';
import { DragDopManager, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { MutableRefObject, RefObject } from 'react';
import { Diagram } from '../../model/diagram.ts';
import { ToolType } from '../../base-ui/ApplicationState.ts';

export interface Tool {
  type: ToolType;

  onMouseDown(id: string, point: Point, modifiers: Modifiers): void;

  onMouseUp(point: Point): void;

  onMouseMove(point: Point, modifiers: Modifiers): void;

  onMouseOver(id: string, point: Point): void;
  onMouseOut(id: string, point: Point): void;

  onKeyDown(e: KeyboardEvent): void;
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

// TODO: Potentially move this to a more general place
export type DeferedMouseAction = {
  callback: () => void;
};

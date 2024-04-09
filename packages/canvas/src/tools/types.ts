import { Diagram } from '@diagram-craft/model';
import { ToolType } from '../ApplicationState.ts';
import { ApplicationTriggers } from '../EditableCanvas.ts';
import { Point } from '@diagram-craft/geometry';
import { DragDopManager, Modifiers } from '../drag/dragDropManager.ts';

export interface Tool {
  type: ToolType;

  onMouseDown(id: string, point: Point, modifiers: Modifiers): void;

  onMouseUp(point: Point): void;

  onMouseMove(point: Point, modifiers: Modifiers): void;

  onMouseOver(id: string, point: Point): void;
  onMouseOut(id: string, point: Point): void;

  onKeyDown(e: KeyboardEvent): void;
  onKeyUp(e: KeyboardEvent): void;
}

export type ToolContructor = {
  new (
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    applicationTriggers: ApplicationTriggers,
    resetTool: () => void
  ): Tool;
};

// TODO: Move this constant somewhere else
export const BACKGROUND = 'background';

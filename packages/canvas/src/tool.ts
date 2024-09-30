import { Point } from '@diagram-craft/geometry/point';
import { DragDopManager, Modifiers } from './dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from './ApplicationTriggers';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Tools {}
  }
}

export interface Tools extends Extensions.Tools {}

export type ToolType = keyof Tools;

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

export type ToolConstructor = {
  new (
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    context: Context,
    resetTool: () => void
  ): Tool;
};

// TODO: Move this constant somewhere else
export const BACKGROUND = 'background';

export abstract class AbstractTool implements Tool {
  currentElement: string | undefined;

  protected constructor(
    public readonly type: ToolType,
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svg: SVGSVGElement | null,
    protected readonly context: Context,
    protected readonly resetTool: () => void
  ) {}

  abstract onMouseDown(id: string, point: Point, modifiers: Modifiers): void;

  abstract onMouseUp(point: Point): void;

  abstract onMouseMove(point: Point, modifiers: Modifiers): void;

  onMouseOver(id: string, _point: Point): void {
    this.currentElement = id;
  }

  onMouseOut(_id: string, _point: Point): void {
    this.currentElement = undefined;
  }

  onKeyDown(_e: KeyboardEvent): void {
    // Do nothing
  }

  onKeyUp(_e: KeyboardEvent): void {
    // Do nothing
  }
}

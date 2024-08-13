import { Tool } from './tool';
import { Point } from '@diagram-craft/geometry/point';
import { Modifiers } from './dragDropManager';
import { ApplicationTriggers } from './ApplicationTriggers';

export type Context = {
  tool: Tool | undefined;
  applicationTriggers: ApplicationTriggers;
  actionMap: Partial<ActionMap>;
};

export type OnMouseDown = (id: string, coord: Point, modifiers: Modifiers) => void;
export type OnDoubleClick = (id: string, coord: Point) => void;

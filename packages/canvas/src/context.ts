import { Point } from '@diagram-craft/geometry/point';
import { Modifiers } from './dragDropManager';

export type OnMouseDown = (id: string, coord: Point, modifiers: Modifiers) => void;
export type OnDoubleClick = (id: string, coord: Point) => void;

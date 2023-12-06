import { Point } from '../geometry/point.ts';

export type Modifiers = {
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type Drag = {
  onDrag: (coord: Point, modifiers: Modifiers) => void;
  onDragEnd: () => void;

  onDragEnter?: (id: string) => void;
  onDragLeave?: () => void;
};

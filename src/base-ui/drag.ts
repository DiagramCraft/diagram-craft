import { Point } from '../geometry/point.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';

export type Modifiers = {
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type Drag = {
  onDrag: (coord: Point, diagram: EditableDiagram, modifiers: Modifiers) => void;
  onDragEnd: (coord: Point, diagram: EditableDiagram) => void;

  onDragEnter?: (id: string) => void;
  onDragLeave?: () => void;
};

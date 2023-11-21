import { Point } from '../geometry/point.ts';
import { Diagram } from '../model-viewer/diagram.ts';
import { SelectionState } from '../model-editor/selectionState.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';

export type Modifiers = {
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type Drag = {
  // TODO: We should move this into the drag actions
  offset: Point;
  actions: DragActions;

  // TODO: We should refactor this to be a callback onto the DragActions, e.g. onDragEnter and onDragLeave
  hoverElement?: string;
};

export type DragActions = {
  onDrag: (
    coord: Point,
    drag: Drag,
    diagram: EditableDiagram,
    selection: SelectionState,
    modifiers: Modifiers
  ) => void;
  onDragEnd: (coord: Point, drag: Drag, diagram: Diagram, selection: SelectionState) => void;
};

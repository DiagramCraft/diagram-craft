import { Point } from '../geometry/point.ts';
import { Diagram } from '../model-viewer/diagram.ts';
import { SelectionState } from '../model-editor/selectionState.ts';

export type Modifiers = {
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type Drag = {
  type:
    | 'resize-nw'
    | 'resize-ne'
    | 'resize-sw'
    | 'resize-se'
    | 'resize-n'
    | 'resize-s'
    | 'resize-w'
    | 'resize-e'
    | 'move-edge-start'
    | 'move-edge-end'
    | 'move'
    | 'rotate'
    | 'marquee';
  offset: Point;
  actions: DragActions;
  state?: Record<string, string>;
  hoverElement?: string;
};

export type DragActions = {
  onDrag: (
    coord: Point,
    drag: Drag,
    diagram: Diagram,
    selection: SelectionState,
    modifiers: Modifiers
  ) => void;
  onDragEnd: (coord: Point, drag: Drag, diagram: Diagram, selection: SelectionState) => void;
};

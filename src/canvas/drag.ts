import { Point } from '../geometry/geometry.ts';
import { LoadedDiagram } from '../model/diagram.ts';
import { SelectionState } from '../model/selectionState.ts';

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
    | 'move'
    | 'rotate'
    | 'marquee';
  offset: Point;
  actions: DragActions;
};

export type DragActions = {
  onDrag: (coord: Point, drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => void;
  onDragEnd: (coord: Point, drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => void;
};

import { DeferedMouseAction, ObjectId } from './types.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DragDropContextType } from '../../react-canvas-viewer/DragDropManager.tsx';
import { MutableRefObject, RefObject } from 'react';
import { Point } from '../../geometry/point.ts';
import { Modifiers } from '../../base-ui/drag.ts';

export abstract class AbstractTool {
  constructor(
    protected readonly diagram: EditableDiagram,
    protected readonly drag: DragDropContextType,
    protected readonly svgRef: RefObject<SVGSVGElement>,
    protected readonly deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    protected readonly resetTool: () => void
  ) {}

  abstract onMouseDown(id: ObjectId, point: Point, modifiers: Modifiers): void;

  abstract onMouseUp(point: Point): void;

  abstract onMouseMove(point: Point, modifiers: Modifiers): void;
}

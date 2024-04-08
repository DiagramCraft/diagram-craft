import { DeferedMouseAction } from './types.ts';
import { MutableRefObject, RefObject } from 'react';
import { Point } from '../../geometry/point.ts';
import { DragDopManager, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { AbstractTool } from './abstractTool.ts';
import { newid } from '@diagram-craft/utils';
import { ElementAddUndoableAction } from '../../model/diagramUndoActions.ts';
import { Diagram } from '../../model/diagram.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { FreeEndpoint } from '../../model/endpoint.ts';
import { ApplicationTriggers } from '../EditableCanvas.ts';

export class EdgeTool extends AbstractTool {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svgRef: RefObject<SVGSVGElement>,
    protected readonly deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('edge', diagram, drag, svgRef, deferedMouseAction, applicationTriggers, resetTool);
    this.svgRef.current!.style.cursor = 'crosshair';
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    const nd = new DiagramEdge(
      newid(),
      new FreeEndpoint(this.diagram.viewBox.toDiagramPoint(point)),
      new FreeEndpoint(Point.add(this.diagram.viewBox.toDiagramPoint(point), { x: 50, y: 50 })),
      {},
      [],
      this.diagram,
      this.diagram.layers.active
    );

    this.diagram.undoManager.addAndExecute(
      new ElementAddUndoableAction([nd], this.diagram, 'Add edge')
    );

    this.diagram.selectionState.clear();
    this.diagram.selectionState.toggle(nd);

    this.resetTool();
  }

  onMouseUp(_point: Point) {
    // Do nothing
  }

  onMouseMove(_point: Point, _modifiers: Modifiers) {
    // Do nothing
  }
}

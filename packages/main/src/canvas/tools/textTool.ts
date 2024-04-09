import { DeferedMouseAction } from './types.ts';
import { MutableRefObject, RefObject } from 'react';
import { AbstractTool } from './abstractTool.ts';
import { DiagramNode } from '@diagram-craft/model';
import { newid } from '@diagram-craft/utils';
import { ElementAddUndoableAction } from '@diagram-craft/model';
import { Diagram } from '@diagram-craft/model';
import { ApplicationTriggers } from '../EditableCanvas.ts';
import { Point } from '@diagram-craft/geometry';
import { DragDopManager, Modifiers } from '../drag/dragDropManager.ts';

export class TextTool extends AbstractTool {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svgRef: RefObject<SVGSVGElement>,
    protected readonly deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('text', diagram, drag, svgRef, deferedMouseAction, applicationTriggers, resetTool);
    this.svgRef.current!.style.cursor = 'text';
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    const nodeType = 'text';
    const nodeDef = this.diagram.nodeDefinitions.get(nodeType);

    const nd = new DiagramNode(
      newid(),
      nodeType,
      {
        ...nodeDef.getInitialConfig().size,
        ...this.diagram.viewBox.toDiagramPoint(point),
        r: 0
      },
      this.diagram,
      this.diagram.layers.active,
      nodeDef.getDefaultProps('canvas')
    );

    this.diagram.undoManager.addAndExecute(
      new ElementAddUndoableAction([nd], this.diagram, 'Add text')
    );

    this.diagram.selectionState.clear();
    this.diagram.selectionState.toggle(nd);

    setTimeout(() => {
      this.diagram.nodeDefinitions.get(nodeType).requestFocus(nd);
    }, 10);

    this.resetTool();
  }

  onMouseUp(_point: Point) {
    // Do nothing
  }

  onMouseMove(_point: Point, _modifiers: Modifiers) {
    // Do nothing
  }
}

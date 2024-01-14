import { MutableRefObject, RefObject } from 'react';
import { DragDopManager, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { DeferedMouseAction } from './types.ts';
import { AbstractTool } from './abstractTool.ts';
import { Diagram } from '../../model/diagram.ts';

export class NodeTool extends AbstractTool {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svgRef: RefObject<SVGSVGElement>,
    protected readonly deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    protected readonly resetTool: () => void
  ) {
    super('node', diagram, drag, svgRef, deferedMouseAction, resetTool);
    if (this.svgRef.current) this.svgRef.current!.style.cursor = 'default';
  }

  onMouseDown(
    _id: string,
    _point: Readonly<{ x: number; y: number }>,
    _modifiers: Modifiers
  ): void {
    console.log('_id', _id);
  }

  onMouseUp(_point: Readonly<{ x: number; y: number }>): void {}

  onMouseMove(_point: Readonly<{ x: number; y: number }>, _modifiers: Modifiers): void {}
}

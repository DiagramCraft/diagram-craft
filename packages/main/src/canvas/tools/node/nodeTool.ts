import { MutableRefObject, RefObject } from 'react';
import { DragDopManager, Modifiers } from '../../../base-ui/drag/dragDropManager.ts';
import { BACKGROUND, DeferedMouseAction } from '../types.ts';
import { AbstractTool } from '../abstractTool.ts';
import { Diagram } from '@diagram-craft/model';
import { isNode } from '@diagram-craft/model';
import { addHighlight, removeHighlight } from '../../highlight.ts';
import { UnitOfWork } from '@diagram-craft/model';
import { ApplicationTriggers } from '../../EditableCanvas.ts';
import { commitWithUndo } from '@diagram-craft/model';
import { Point } from '@diagram-craft/geometry';

export class NodeTool extends AbstractTool {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svgRef: RefObject<SVGSVGElement>,
    protected readonly deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('node', diagram, drag, svgRef, deferedMouseAction, applicationTriggers, resetTool);
    if (this.svgRef.current) this.svgRef.current!.style.cursor = 'default';

    if (
      diagram.selectionState.getSelectionType() !== 'single-node' &&
      diagram.selectionState.nodes[0]?.nodeType !== 'generic-path'
    ) {
      diagram.selectionState.clear();
    }
  }

  onMouseOver(id: string, point: Point) {
    super.onMouseOver(id, point);

    const el = this.diagram.lookup(id);
    if (this.diagram.selectionState.elements.includes(el!)) return;
    if (isNode(el)) {
      if (el.nodeType === 'generic-path') {
        addHighlight(el, 'node-tool-edit');
      } else if (el.nodeType !== 'text') {
        addHighlight(el, 'node-tool-convert');
      }
    }
  }

  onMouseOut(id: string, point: Point) {
    super.onMouseOut(id, point);

    const el = this.diagram.lookup(id);
    if (isNode(el)) {
      removeHighlight(el, 'node-tool-edit');
      removeHighlight(el, 'node-tool-convert');
    }
  }

  onMouseDown(id: string, _point: Readonly<{ x: number; y: number }>, _modifiers: Modifiers): void {
    const isClickOnBackground = id === BACKGROUND;

    if (isClickOnBackground) {
      this.resetTool();
      return;
    }

    const el = this.diagram.lookup(id);
    if (isNode(el)) {
      if (el.nodeType === 'generic-path') {
        this.diagram.selectionState.setElements([el]);
      } else if (el.nodeType !== 'text') {
        this.applicationTriggers.showDialog!(
          'Convert to path',
          'Do you want to convert this shape to a editable path?',
          'Yes',
          'Cancel',
          () => {
            const uow = new UnitOfWork(this.diagram, true);
            el.convertToPath(uow);
            commitWithUndo(uow, 'Convert to path');
            this.diagram.selectionState.setElements([el]);
          }
        );
      }
    }
  }

  onMouseUp(_point: Readonly<{ x: number; y: number }>): void {
    const current = this.drag.current();
    current?.onDragEnd();
    this.drag.clear();
  }

  onMouseMove(point: Readonly<{ x: number; y: number }>, modifiers: Modifiers): void {
    const current = this.drag.current();
    current?.onDrag(this.diagram.viewBox.toDiagramPoint(point), modifiers);
  }

  onKeyDown(e: KeyboardEvent) {
    const current = this.drag.current();
    current?.onKeyDown?.(e);
  }
}

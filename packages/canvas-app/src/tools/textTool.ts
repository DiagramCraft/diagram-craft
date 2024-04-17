import { AbstractTool } from '@diagram-craft/canvas/tool';
import { ApplicationTriggers } from '@diagram-craft/canvas/EditableCanvasComponent';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { newid } from '@diagram-craft/utils/id';

declare global {
  interface Tools {
    text: TextTool;
  }
}

export class TextTool extends AbstractTool {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svg: SVGSVGElement | null,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('text', diagram, drag, svg, applicationTriggers, resetTool);
    if (this.svg) this.svg.style.cursor = 'text';
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    const nodeType = 'text';
    const nodeDef = this.diagram.document.nodeDefinitions.get(nodeType);

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
      this.diagram.document.nodeDefinitions.get(nodeType).requestFocus(nd);
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

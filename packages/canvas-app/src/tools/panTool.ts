import { AbstractTool } from '@diagram-craft/canvas/tool';
import { ApplicationTriggers } from '@diagram-craft/canvas/EditableCanvasComponent';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from '@diagram-craft/model/diagram';

declare global {
  interface Tools {
    pan: PanTool;
  }
}

export class PanTool extends AbstractTool {
  private mouseDown = false;
  private clickPoint: Point | undefined = undefined;
  private clickOffset: Point | undefined = undefined;

  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svg: SVGSVGElement | null,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('pan', diagram, drag, svg, applicationTriggers, resetTool);

    applicationTriggers.pushHelp?.('pan', 'Click and drag to pan');
  }

  onKeyUp(_e: KeyboardEvent) {
    this.applicationTriggers.popHelp?.('pan');
    this.resetTool();
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    this.mouseDown = true;
    this.clickPoint = point;
    this.clickOffset = this.diagram.viewBox.offset;
  }

  onMouseUp(_point: Point) {
    this.mouseDown = false;
  }

  onMouseMove(point: Point, _modifiers: Modifiers) {
    if (this.mouseDown) {
      const mouseDiff = Point.subtract(
        this.diagram.viewBox.toDiagramPoint(point),
        this.diagram.viewBox.toDiagramPoint(this.clickPoint!)
      );
      const newOffset = Point.subtract(this.clickOffset!, mouseDiff);
      this.diagram.viewBox.pan(newOffset);
    }
  }
}

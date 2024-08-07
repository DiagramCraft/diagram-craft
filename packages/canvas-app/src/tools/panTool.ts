import { AbstractTool } from '@diagram-craft/canvas/tool';
import { ApplicationTriggers } from '@diagram-craft/canvas/EditableCanvasComponent';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { AbsoluteOffset, Point } from '@diagram-craft/geometry/point';
import { Diagram } from '@diagram-craft/model/diagram';

declare global {
  interface Tools {
    pan: PanTool;
  }
}

export class PanTool extends AbstractTool {
  private isMouseDown = false;
  private clickPoint: Point | undefined = undefined;
  private clickOffset: AbsoluteOffset | undefined = undefined;
  private resetOnMouseUp = false;

  constructor(
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    applicationTriggers: ApplicationTriggers,
    resetTool: () => void
  ) {
    super('pan', diagram, drag, svg, applicationTriggers, resetTool);

    applicationTriggers.pushHelp?.('pan', 'Click and drag to pan');
  }

  setResetOnMouseUp(reset: boolean) {
    this.resetOnMouseUp = reset;
  }

  onKeyUp() {
    this.applicationTriggers.popHelp?.('pan');
    this.resetTool();
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    this.isMouseDown = true;
    this.clickPoint = point;
    this.clickOffset = this.diagram.viewBox.offset;
  }

  onMouseUp() {
    this.isMouseDown = false;
    if (this.resetOnMouseUp) {
      this.resetTool();
    }
  }

  onMouseMove(point: Point, _modifiers: Modifiers) {
    if (!this.isMouseDown) return;

    const mouseDiff = Point.subtract(
      this.diagram.viewBox.toDiagramPoint(point),
      this.diagram.viewBox.toDiagramPoint(this.clickPoint!)
    );
    const newOffset = Point.subtract(this.clickOffset!, mouseDiff);
    this.diagram.viewBox.pan(newOffset);
  }
}

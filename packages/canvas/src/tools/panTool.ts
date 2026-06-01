import type { Context } from '../context';
import { type DragDopManager, type Modifiers } from '../dragDropManager';
import { AbstractTool } from '../tool';
import { type AbsoluteOffset, Point } from '@diagram-craft/geometry/point';
import { type Diagram } from '@diagram-craft/model/diagram';

export class PanTool extends AbstractTool {
  private isMouseDown = false;
  private clickPoint: Point | undefined = undefined;
  private clickOffset: AbsoluteOffset | undefined = undefined;
  private resetOnMouseUp = false;

  constructor(
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    context: Context,
    resetTool: () => void
  ) {
    super('pan', diagram, drag, svg, context, resetTool);

    context.help.push('pan', 'Click and drag to pan');
  }

  setResetOnMouseUp(reset: boolean) {
    this.resetOnMouseUp = reset;
  }

  onKeyUp() {
    this.context.help.pop('pan');
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

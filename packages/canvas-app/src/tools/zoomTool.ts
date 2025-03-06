import { AbstractTool } from '@diagram-craft/canvas/tool';
import { Context } from '@diagram-craft/canvas/context';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from '@diagram-craft/model/diagram';
import { fitInAspectRatio } from '@diagram-craft/model/viewBox';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Tools {
      zoom: ZoomTool;
    }
  }
}

export class ZoomTool extends AbstractTool {
  private clickPoint: Point | undefined = undefined;
  private lastPoint: Point | undefined = undefined;
  private zoomRect: SVGRectElement | undefined = undefined;

  constructor(
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    context: Context,
    resetTool: () => void
  ) {
    super('zoom', diagram, drag, svg, context, resetTool);

    context.help.push('zoom', 'Click and drag to zoom');
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    this.clickPoint = point;

    this.zoomRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.zoomRect.setAttribute('class', 'svg-marquee');

    const p = this.diagram.viewBox.toDiagramPoint(point);
    this.zoomRect.setAttribute('x', p.x.toString());
    this.zoomRect.setAttribute('y', p.y.toString());
    this.zoomRect.setAttribute('width', '0');
    this.zoomRect.setAttribute('height', '0');

    this.svg!.appendChild(this.zoomRect);
  }

  onMouseUp() {
    const p1 = this.diagram.viewBox.toDiagramPoint(this.clickPoint!);
    const p2 = this.diagram.viewBox.toDiagramPoint(this.lastPoint!);

    const newW = Math.abs(p2.x - p1.x);
    const newH = Math.abs(p2.y - p1.y);

    const newX = Math.min(p1.x, p2.x);
    const newY = Math.min(p1.y, p2.y);

    this.diagram.viewBox.offset = {
      x: newX,
      y: newY
    };

    const aspectRatio = this.diagram.viewBox.aspectRatio;

    this.diagram.viewBox.dimensions = fitInAspectRatio(newW, newH, aspectRatio);

    this.svg?.removeChild(this.zoomRect!);
    this.zoomRect = undefined;

    this.clickPoint = undefined;

    this.resetTool();
  }

  onMouseMove(point: Readonly<{ x: number; y: number }>) {
    this.lastPoint = point;

    if (!this.clickPoint) return;

    const p1 = this.diagram.viewBox.toDiagramPoint(this.clickPoint!);
    const p2 = this.diagram.viewBox.toDiagramPoint(point);

    const newW = Math.abs(p2.x - p1.x);
    const newH = Math.abs(p2.y - p1.y);

    const newX = Math.min(p1.x, p2.x);
    const newY = Math.min(p1.y, p2.y);

    this.zoomRect!.setAttribute('x', newX.toString());
    this.zoomRect!.setAttribute('y', newY.toString());
    this.zoomRect!.setAttribute('width', newW.toString());
    this.zoomRect!.setAttribute('height', newH.toString());
  }
}

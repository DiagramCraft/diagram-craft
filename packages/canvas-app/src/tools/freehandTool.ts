import { AbstractTool } from '@diagram-craft/canvas/tool';
import { ApplicationTriggers } from '@diagram-craft/canvas/EditableCanvasComponent';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { inverseUnitCoordinateSystem, PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { newid } from '@diagram-craft/utils/id';

declare global {
  interface Tools {
    freehand: FreehandTool;
  }
}

const perpendicularDistance = (p: Point, start: Point, end: Point) => {
  let x = start.x;
  let y = start.y;
  let dx = end.x - x;
  let dy = end.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = end.x;
      y = end.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;

  return dx * dx + dy * dy;
};

export class FreehandTool extends AbstractTool {
  private path: SVGPathElement | undefined;
  private isDrawing = false;
  private points: Point[] = [];

  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svg: SVGSVGElement | null,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('freehand', diagram, drag, svg, applicationTriggers, resetTool);

    applicationTriggers.setHelp?.('Draw shape');
  }

  onMouseDown(_id: string, point: Readonly<{ x: number; y: number }>, _modifiers: Modifiers): void {
    const diagramPoint = this.diagram.viewBox.toDiagramPoint(point);
    this.isDrawing = true;
    this.points.push(diagramPoint);

    this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.path.setAttribute('id', 'path');
    this.path.setAttribute('d', '');
    this.path.setAttribute('fill', 'none');
    this.path.setAttribute('stroke', 'black');
    this.path.setAttribute('stroke-width', '2');

    this.svg?.appendChild(this.path);
  }

  onMouseMove(point: Readonly<{ x: number; y: number }>, _modifiers: Modifiers): void {
    if (this.isDrawing) {
      const diagramPoint = this.diagram.viewBox.toDiagramPoint(point);
      this.points.push(diagramPoint);
      this.draw();
    }
  }

  onMouseUp(_point: Point): void {
    const pts = this.douglasPeucker(this.smoothenPoints(), 1);
    const pathData = FreehandTool.makePath(pts);

    const bbox = this.path!.getBBox();

    // TODO: This removes all T commands and converts them to C
    const path = PathBuilder.fromString(
      pathData.join(' '),
      inverseUnitCoordinateSystem({
        x: bbox.x,
        y: bbox.y,
        w: bbox.width,
        h: bbox.height,
        r: 0
      })
    )
      .getPaths()
      .singularPath()
      .asSvgPath();

    const node = new DiagramNode(
      newid(),
      'generic-path',
      { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height, r: 0 },
      this.diagram,
      this.diagram.layers.active,
      { shapeGenericPath: { path: path }, fill: { enabled: false } }
    );

    const uow = new UnitOfWork(this.diagram);
    this.diagram.layers.active.addElement(node, uow);
    uow.commit();

    this.path!.remove();
    this.points = [];
    this.isDrawing = false;
  }

  // @ts-ignore
  private douglasPeucker(points: Point[], tolerance: number): Point[] {
    if (points.length === 2) return [points[0], points[1]];
    let dmax = 0;
    let index = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }
    if (dmax > tolerance) {
      const results1 = this.douglasPeucker(points.slice(0, index), tolerance);
      const results2 = this.douglasPeucker(points.slice(index), tolerance);
      return results1.slice(0, results1.length - 1).concat(results2);
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  private draw() {
    const pts = this.smoothenPoints();
    const pathData = FreehandTool.makePath(pts);

    this.path!.setAttribute('d', pathData.join(' '));
  }

  private smoothenPoints() {
    const pts = [];
    pts.push(this.points[0]);
    for (let i = 1; i < this.points.length - 1; i++) {
      pts.push({
        x: pts.at(-1)!.x + (this.points[i].x - pts.at(-1)!.x) * 0.5,
        y: pts.at(-1)!.y + (this.points[i].y - pts.at(-1)!.y) * 0.5
      });
    }
    pts.push(this.points[this.points.length - 1]);
    return pts;
  }

  private static makePath(pts: Point[]) {
    const pathData = ['M', pts[0].x, pts[0].y];
    for (let i = 1; i < pts.length; i++) {
      const point = pts[i];
      const next = pts[i + 1] ?? point;
      if (i === 1) {
        pathData.push('Q', point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
      } else {
        pathData.push('T', (point.x + next.x) / 2, (point.y + next.y) / 2);
      }
    }
    return pathData;
  }
}

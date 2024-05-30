import { AbstractTool } from '@diagram-craft/canvas/tool';
import { ApplicationTriggers } from '@diagram-craft/canvas/EditableCanvasComponent';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { PathUtils } from '@diagram-craft/geometry/pathUtils';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { newid } from '@diagram-craft/utils/id';

declare global {
  interface Tools {
    pen: PenTool;
  }
}

export class PenTool extends AbstractTool {
  private node: DiagramNode | undefined;

  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svg: SVGSVGElement | null,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('node', diagram, drag, svg, applicationTriggers, resetTool);
    if (this.svg) this.svg.style.cursor = 'default';

    applicationTriggers.setHelp?.('Draw shape');
  }

  onMouseOver(id: string, point: Point) {
    super.onMouseOver(id, point);
  }

  onMouseOut(id: string, point: Point) {
    super.onMouseOut(id, point);
  }

  onMouseDown(_id: string, point: Readonly<{ x: number; y: number }>, _modifiers: Modifiers): void {
    const diagramPoint = this.diagram.viewBox.toDiagramPoint(point);
    if (!this.node) {
      this.node = new DiagramNode(
        newid(),
        'generic-path',
        { x: diagramPoint.x, y: diagramPoint.y, w: 10, h: 10, r: 0 },
        this.diagram,
        this.diagram.layers.active,
        {
          genericPath: {
            path: `M 0 0`
          }
        }
      );

      const uow = new UnitOfWork(this.diagram);
      this.diagram.layers.active.addElement(this.node, uow);
      uow.commit();
    } else {
      this.addPoint(diagramPoint);
    }
  }

  private addPoint(diagramPoint: Point, deleteOld = false) {
    const uow = new UnitOfWork(this.diagram);

    const currentPath = PathBuilder.fromString(
      this.node!.renderProps.genericPath!.path!,
      unitCoordinateSystem(this.node!.bounds)
    )
      .getPaths()
      .singularPath();

    const svgPath = currentPath.asSvgPath();
    const svgPathPrefix =
      svgPath.split(',').length > (deleteOld ? 2 : 1)
        ? svgPath
            .split(',')
            .slice(0, deleteOld ? -2 : -1)
            .join(', ')
        : svgPath;

    const newPathSpec =
      svgPathPrefix +
      `, L ${diagramPoint.x} ${diagramPoint.y}, L ${currentPath.start.x} ${currentPath.start.y}`;

    const path = PathBuilder.fromString(newPathSpec).getPaths().singularPath();

    const bounds = path.bounds();

    this.node!.updateProps(p => {
      p.genericPath!.path = PathUtils.scalePath(path, bounds, {
        x: -1,
        y: 1,
        w: 2,
        h: -2,
        r: 0
      }).asSvgPath();
    }, uow);
    this.node!.setBounds(bounds, uow);
    uow.commit();
  }

  onMouseUp(_point: Readonly<{ x: number; y: number }>): void {}

  onMouseMove(point: Readonly<{ x: number; y: number }>, _modifiers: Modifiers): void {
    if (this.node) {
      const diagramPoint = this.diagram.viewBox.toDiagramPoint(point);
      this.addPoint(diagramPoint, true);
    }
  }

  onKeyDown(_e: KeyboardEvent) {
    if (this.node) {
      this.diagram.undoManager.add(
        new ElementAddUndoableAction([this.node], this.diagram, 'Add path')
      );
    }
    this.node = undefined;
  }
}

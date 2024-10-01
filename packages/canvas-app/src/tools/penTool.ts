import { AbstractTool } from '@diagram-craft/canvas/tool';
import { Context } from '@diagram-craft/canvas/context';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { PathUtils } from '@diagram-craft/geometry/pathUtils';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { newid } from '@diagram-craft/utils/id';
import { Path } from '@diagram-craft/geometry/path';
import { assert } from '@diagram-craft/utils/assert';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Tools {
      pen: PenTool;
    }
  }
}

const UNIT_BOUNDS = { x: 0, y: 0, w: 1, h: 1, r: 0 };

export class PenTool extends AbstractTool {
  private node: DiagramNode | undefined;
  private path: Path | undefined;
  private numberOfPoints: number = 0;

  constructor(
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    context: Context,
    resetTool: () => void
  ) {
    super('pen', diagram, drag, svg, context, resetTool);
    if (this.svg) this.svg.style.cursor = 'default';

    assertRegularLayer(diagram.activeLayer);

    context.help.set(
      "Click to add corners. Press 'Escape' to cancel or any other key to complete the shape"
    );
  }

  onMouseDown(_id: string, point: Readonly<{ x: number; y: number }>, _modifiers: Modifiers): void {
    const diagramPoint = this.diagram.viewBox.toDiagramPoint(point);
    if (!this.node) {
      const initialPath = { x: 0, y: 0 };

      this.node = new DiagramNode(
        newid(),
        'generic-path',
        { x: diagramPoint.x, y: diagramPoint.y, w: 10, h: 10, r: 0 },
        this.diagram,
        this.diagram.activeLayer,
        { custom: { genericPath: { path: `M ${initialPath.x},${initialPath.y}` } } },
        {}
      );

      this.path = new Path(this.node.bounds, []);

      const uow = new UnitOfWork(this.diagram);

      assertRegularLayer(this.diagram.activeLayer);
      this.diagram.activeLayer.addElement(this.node, uow);
      uow.commit();
    } else {
      this.addPoint(diagramPoint);
      this.numberOfPoints++;
    }
  }

  private addPoint(diagramPoint: Point) {
    // TODO: Minor, but ideally we should check with the last point
    //       instead of the starting point
    if (Point.isEqual(this.path!.start, diagramPoint)) return;

    assert.present(this.path);
    this.path.add(['L', diagramPoint.x, diagramPoint.y]);
    this.path.add(['L', this.path.start.x, this.path.start.y]);

    this.updateNode();
  }

  onMouseMove(point: Readonly<{ x: number; y: number }>, _modifiers: Modifiers): void {
    if (this.node) {
      const diagramPoint = this.diagram.viewBox.toDiagramPoint(point);
      this.popTempPoints();
      this.addPoint(diagramPoint);
    }
  }

  onKeyDown(e: KeyboardEvent) {
    if (this.node) {
      if (e.key === 'Escape') {
        const uow = new UnitOfWork(this.diagram);
        assertRegularLayer(this.node.layer);
        this.node.layer.removeElement(this.node, uow);
        uow.commit();

        this.resetState();
        return;
      }

      this.popTempPoints();

      assert.present(this.path);
      this.path.add(['L', this.path.start.x, this.path.start.y]);

      this.updateNode();

      assertRegularLayer(this.diagram.activeLayer);
      this.diagram.undoManager.add(
        new ElementAddUndoableAction(
          [this.node],
          this.diagram,
          this.diagram.activeLayer,
          'Add path'
        )
      );

      this.resetTool();
    }

    this.resetState();
  }

  onMouseOver(id: string, point: Point) {
    super.onMouseOver(id, point);
  }

  onMouseOut(id: string, point: Point) {
    super.onMouseOut(id, point);
  }

  onMouseUp(_point: Readonly<{ x: number; y: number }>): void {}

  private updateNode() {
    assert.present(this.path);
    const bounds = this.path.bounds();

    const scaledPath = PathUtils.scalePath(this.path, bounds, UNIT_BOUNDS);

    const uow = new UnitOfWork(this.diagram);
    this.node!.updateCustomProps('genericPath', p => (p.path = scaledPath.asSvgPath()), uow);
    this.node!.setBounds(bounds, uow);
    uow.commit();
  }

  private popTempPoints() {
    assert.present(this.path);
    while (this.path.segmentCount > this.numberOfPoints) this.path.pop();
  }

  private resetState() {
    this.node = undefined;
    this.path = undefined;
    this.numberOfPoints = 0;
  }
}

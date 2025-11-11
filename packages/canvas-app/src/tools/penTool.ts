import { AbstractTool } from '@diagram-craft/canvas/tool';
import { Context } from '@diagram-craft/canvas/context';
import { DragDopManager, Modifiers } from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { newid } from '@diagram-craft/utils/id';
import { assert } from '@diagram-craft/utils/assert';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { isSame } from '@diagram-craft/utils/math';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

declare global {
  namespace DiagramCraft {
    interface Tools {
      pen: PenTool;
    }
  }
}

const UNIT_BOUNDS = { x: 0, y: 0, w: 1, h: 1, r: 0 };

export class PenTool extends AbstractTool {
  private node: DiagramNode | undefined;
  private builder: PathListBuilder | undefined;
  private numberOfPoints: number = 0;
  private start: Point | undefined;

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
    const layer = this.diagram.activeLayer;
    assertRegularLayer(layer);

    const diagramPoint = this.diagram.viewBox.toDiagramPoint(point);
    if (!this.node) {
      const initialPath = { x: 0, y: 0 };

      this.node = ElementFactory.node(
        newid(),
        'generic-path',
        { x: diagramPoint.x, y: diagramPoint.y, w: 10, h: 10, r: 0 },
        layer,
        { custom: { genericPath: { path: `M ${initialPath.x},${initialPath.y}` } } },
        {}
      );

      this.builder = new PathListBuilder();

      this.start = this.node.bounds;
      this.builder.moveTo(this.node.bounds);

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
    if (Point.isEqual(this.start!, diagramPoint)) return;

    assert.present(this.builder);
    this.builder.lineTo(diagramPoint);
    this.builder.close();

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

      this.closeObject();
      this.resetTool();
    }

    this.resetState();
  }

  onToolChange(): void {
    if (this.node) {
      this.closeObject();
    }
    this.resetState();
  }

  private closeObject() {
    this.popTempPoints();

    assert.present(this.builder);
    this.builder.close();

    this.updateNode();

    assertRegularLayer(this.diagram.activeLayer);
    this.diagram.undoManager.add(
      new ElementAddUndoableAction([this.node!], this.diagram, this.diagram.activeLayer, 'Add path')
    );
  }

  onMouseOver(id: string, point: Point, target: EventTarget) {
    super.onMouseOver(id, point, target);
  }

  onMouseOut(id: string, point: Point, target: EventTarget) {
    super.onMouseOut(id, point, target);
  }

  onMouseUp(_point: Readonly<{ x: number; y: number }>): void {}

  private updateNode() {
    assert.present(this.builder);

    const b = this.builder.bounds();
    const path = this.builder
      .getPaths(
        TransformFactory.fromTo(
          {
            ...b,
            w: isSame(b.w, 0) ? 0.1 : b.w,
            h: isSame(b.h, 0) ? 0.1 : b.h
          },
          UNIT_BOUNDS
        )
      )
      .singular();

    const uow = new UnitOfWork(this.diagram);
    this.node!.updateCustomProps('genericPath', p => (p.path = path.asSvgPath()), uow);
    this.node!.setBounds(this.builder.bounds(), uow);
    uow.commit();
  }

  private popTempPoints() {
    assert.present(this.builder);
    while (this.builder.activeInstructionCount > this.numberOfPoints) {
      this.builder.popInstruction();
    }
  }

  private resetState() {
    this.node = undefined;
    this.builder = undefined;
    this.start = undefined;
    this.numberOfPoints = 0;
  }
}

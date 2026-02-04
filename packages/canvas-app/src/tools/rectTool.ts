import { AbstractTool } from '@diagram-craft/canvas/tool';
import { Context } from '@diagram-craft/canvas/context';
import {
  DRAG_DROP_MANAGER,
  DragDopManager,
  Modifiers
} from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { ResizeDrag } from '@diagram-craft/canvas/drag/resizeDrag';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

export class RectTool extends AbstractTool {
  private node: DiagramNode | undefined;
  private startPoint: Point | undefined;

  constructor(
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    context: Context,
    resetTool: () => void
  ) {
    super('rect', diagram, drag, svg, context, resetTool);

    assertRegularLayer(diagram.activeLayer);
    context.help.set('Click and drag to add rectangle');
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    const layer = this.diagram.activeLayer;
    assertRegularLayer(layer);

    this.startPoint = this.diagram.viewBox.toDiagramPoint(point);
    this.node = ElementFactory.node(
      newid(),
      'rect',
      {
        ...this.diagram.viewBox.toDiagramPoint(point),
        w: 5,
        h: 5,
        r: 0
      },
      layer,
      {},
      {
        style: DefaultStyles.node.default
      }
    );

    const undoManager = this.diagram.undoManager;
    undoManager.setMark();

    UnitOfWork.executeWithUndo(this.diagram, 'Add rectangle', uow => {
      layer.addElement(this.node!, uow);
      uow.select(this.diagram, [this.node!]);
    });

    this.resetTool();

    const drag = new ResizeDrag(
      this.diagram,
      'se',
      Point.subtract(this.startPoint, { x: 5, y: 5 })
    );
    drag.on('dragEnd', () => {
      UnitOfWork.executeWithUndo(this.diagram, 'Set bounds', uow => {
        this.node?.setBounds(
          {
            ...this.node.bounds,
            w: Math.max(10, this.node?.bounds.w),
            h: Math.max(10, this.node?.bounds.h)
          },
          uow
        );
      });

      // Coalesce the element add and edge endpoint move into one undoable action
      // We know that the first action is the element added and the last is the last bounds
      const actions = undoManager.getToMark();
      undoManager.add(new CompoundUndoableAction([actions[0]!, actions.at(-1)!]));
    });

    DRAG_DROP_MANAGER.initiate(drag);
  }

  onMouseUp(_point: Point) {}

  onMouseMove(_point: Point, _modifiers: Modifiers) {}
}

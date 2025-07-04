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
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { newid } from '@diagram-craft/utils/id';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { ResizeDrag } from '@diagram-craft/canvas/drag/resizeDrag';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Tools {
      rect: RectTool;
    }
  }
}

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
    this.startPoint = this.diagram.viewBox.toDiagramPoint(point);
    this.node = new DiagramNode(
      newid(),
      'rect',
      {
        ...this.diagram.viewBox.toDiagramPoint(point),
        w: 5,
        h: 5,
        r: 0
      },
      this.diagram.activeLayer,
      {},
      {
        style: DefaultStyles.node.default
      }
    );

    const undoManager = this.diagram.undoManager;
    undoManager.setMark();

    assertRegularLayer(this.diagram.activeLayer);
    this.diagram.undoManager.addAndExecute(
      new ElementAddUndoableAction(
        [this.node],
        this.diagram,
        this.diagram.activeLayer,
        'Add rectangle'
      )
    );

    this.diagram.selectionState.setElements([this.node]);

    this.resetTool();

    const drag = new ResizeDrag(
      this.diagram,
      'se',
      Point.subtract(this.startPoint, { x: 5, y: 5 })
    );
    drag.on('dragEnd', () => {
      UnitOfWork.execute(this.diagram, uow => {
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
      undoManager.add(new CompoundUndoableAction([...undoManager.getToMark()]));
    });

    DRAG_DROP_MANAGER.initiate(drag);
  }

  onMouseUp(_point: Point) {}

  onMouseMove(_point: Point, _modifiers: Modifiers) {}
}

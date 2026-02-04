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

export class TextTool extends AbstractTool {
  private node: DiagramNode | undefined;
  private startPoint: Point | undefined;

  constructor(
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    context: Context,
    resetTool: () => void
  ) {
    super('text', diagram, drag, svg, context, resetTool);

    assertRegularLayer(diagram.activeLayer);
    context.help.set('Click to add text');
  }

  onMouseDown(_id: string, point: Point, _modifiers: Modifiers) {
    const layer = this.diagram.activeLayer;
    assertRegularLayer(layer);

    this.startPoint = this.diagram.viewBox.toDiagramPoint(point);
    this.node = ElementFactory.node(
      newid(),
      'text',
      {
        ...this.diagram.viewBox.toDiagramPoint(point),
        w: 0,
        h: 0,
        r: 0
      },
      layer,
      // TODO: This is partially duplicated in defaultRegistry.ts
      //       - perhaps make static member of Text.nodeType.ts
      {
        stroke: {
          enabled: false
        },
        fill: {
          enabled: false
        },
        text: {
          align: 'left',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0
        }
      },
      {
        style: DefaultStyles.node.text
      },
      {
        text: 'Text'
      }
    );

    const undoManager = this.diagram.undoManager;
    undoManager.setMark();

    UnitOfWork.executeWithUndo(this.diagram, 'Add text', uow => {
      layer.addElement(this.node!, uow);
      uow.select(this.diagram, [this.node!]);
    });

    this.resetTool();

    const drag = new ResizeDrag(this.diagram, 'se', this.startPoint);
    drag.on('dragEnd', () => {
      UnitOfWork.executeWithUndo(this.diagram, 'Resize/move', uow => {
        this.node?.setBounds(
          {
            ...this.node.bounds,
            w: Math.max(25, this.node?.bounds.w),
            h: Math.max(10, this.node?.bounds.h)
          },
          uow
        );
      });

      // Coalesce the element add and edge endpoint move into one undoable action
      // We know that the first action is the element added and the last is the last bounds
      const actions = undoManager.getToMark();
      undoManager.add(new CompoundUndoableAction([actions[0]!, actions.at(-1)!]));

      setTimeout(() => {
        this.diagram.document.registry.nodes.get('text').requestFocus(this.node!);
      }, 10);
    });

    DRAG_DROP_MANAGER.initiate(drag);
  }

  onMouseUp(_point: Point) {}

  onMouseMove(_point: Point, _modifiers: Modifiers) {}
}

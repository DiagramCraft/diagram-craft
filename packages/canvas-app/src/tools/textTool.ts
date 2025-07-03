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
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerRegular';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Tools {
      text: TextTool;
    }
  }
}

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
    this.startPoint = this.diagram.viewBox.toDiagramPoint(point);
    this.node = new DiagramNode(
      newid(),
      'text',
      {
        ...this.diagram.viewBox.toDiagramPoint(point),
        w: 0,
        h: 0,
        r: 0
      },
      this.diagram.activeLayer,
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
    assertRegularLayer(this.diagram.activeLayer);
    this.diagram.undoManager.addAndExecute(
      new ElementAddUndoableAction([this.node], this.diagram, this.diagram.activeLayer, 'Add text')
    );

    this.diagram.selectionState.setElements([this.node]);

    this.resetTool();

    const drag = new ResizeDrag(this.diagram, 'se', this.startPoint);
    drag.on('dragEnd', () => {
      UnitOfWork.execute(this.diagram, uow => {
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
      undoManager.add(new CompoundUndoableAction([...undoManager.getToMark()]));

      setTimeout(() => {
        this.diagram.document.nodeDefinitions.get('text').requestFocus(this.node!);
      }, 10);
    });

    DRAG_DROP_MANAGER.initiate(drag);
  }

  onMouseUp(_point: Point) {}

  onMouseMove(_point: Point, _modifiers: Modifiers) {}
}

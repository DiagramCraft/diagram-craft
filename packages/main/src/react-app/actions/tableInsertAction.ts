import { State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';

export const tableInsertActions = (state: State) => ({
  TABLE_INSERT: new TableInsertAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof tableInsertActions> {}
}

class TableInsertAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    context.applicationTriggers?.showDialog?.({
      name: 'tableInsert',
      onOk: async props => {
        const { width, height } = props as { width: number; height: number };

        const colWidth = 100;
        const rowHeight = 40;

        const uow = new UnitOfWork(this.diagram, false);

        const bounds = { w: colWidth * width, h: rowHeight * height, x: 0, y: 0, r: 0 };

        // TODO: We should look at the viewport and try to center the table in the viewport
        bounds.x = (this.diagram.canvas.w - bounds.w) / 2;
        bounds.y = (this.diagram.canvas.h - bounds.h) / 2;

        const elements: DiagramElement[] = [];

        const table = new DiagramNode(
          newid(),
          'table',
          bounds,
          this.diagram,
          this.diagram.layers.active,
          {},
          {}
        );
        elements.push(table);

        for (let r = 0; r < height; r++) {
          const row = new DiagramNode(
            newid(),
            'tableRow',
            { w: bounds.w, h: rowHeight, x: 0, y: r * rowHeight, r: 0 },
            this.diagram,
            this.diagram.layers.active,
            {},
            {}
          );
          table.addChild(row, uow);
          elements.push(row);

          for (let c = 0; c < width; c++) {
            const cell = new DiagramNode(
              newid(),
              'text',
              { w: colWidth, h: rowHeight, x: c * colWidth, y: 0, r: 0 },
              this.diagram,
              this.diagram.layers.active,
              {
                fill: {
                  enabled: true
                },
                text: {
                  bold: r === 0
                }
              },
              {}
            );
            row.addChild(cell, uow);
            elements.push(cell);
          }
        }

        uow.commit();
        this.diagram.undoManager.addAndExecute(
          new ElementAddUndoableAction(elements, this.diagram, 'Add table')
        );
      },
      onCancel: () => {}
    });
  }
}

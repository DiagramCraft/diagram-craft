import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';
import { ApplicationTriggers } from '@diagram-craft/canvas/ApplicationTriggers';

export const tableInsertActions = (state: ActionConstructionParameters) => ({
  TABLE_INSERT: new TableInsertAction(state.diagram, state.applicationTriggers)
});

declare global {
  interface ActionMap extends ReturnType<typeof tableInsertActions> {}

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Dialogs {
      tableInsert: {
        props: Record<string, never>;
        callback: { width: number; height: number };
      };
    }
  }
}

class TableInsertAction extends AbstractAction {
  constructor(
    private readonly diagram: Diagram,
    private readonly applicationTriggers: ApplicationTriggers
  ) {
    super();
    this.addCriterion(diagram, 'change', () => diagram.activeLayer.type === 'regular');
  }

  execute(_context: ActionContext): void {
    assertRegularLayer(this.diagram.activeLayer);

    this.applicationTriggers.showDialog?.({
      name: 'tableInsert',
      props: {},
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
          this.diagram.activeLayer,
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
            this.diagram.activeLayer,
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
              this.diagram.activeLayer,
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
        assertRegularLayer(this.diagram.activeLayer);
        this.diagram.undoManager.addAndExecute(
          new ElementAddUndoableAction(
            elements,
            this.diagram,
            this.diagram.activeLayer,
            'Add table'
          )
        );
      },
      onCancel: () => {}
    });
  }
}

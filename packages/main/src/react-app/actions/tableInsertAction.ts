import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { Application } from '../../application';
import { TableInsertDialog } from '../TableInsertDialog';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

export const tableInsertActions = (application: Application) => ({
  TABLE_INSERT: new TableInsertAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof tableInsertActions> {}
}

class TableInsertAction extends AbstractAction<undefined, Application> {
  getCriteria(application: Application) {
    return ActionCriteria.EventTriggered(
      application.model.activeDiagram.layers,
      'layerStructureChange',
      () =>
        application.model.activeDiagram.activeLayer.type === 'regular' &&
        !application.model.activeDiagram.activeLayer.isLocked()
    );
  }

  execute(): void {
    const $d = this.context.model.activeDiagram;

    const layer = $d.activeLayer;
    assertRegularLayer(layer);

    this.context.ui.showDialog(
      TableInsertDialog.create(async props => {
        const { width, height } = props as { width: number; height: number };

        const colWidth = 100;
        const rowHeight = 40;

        const uow = new UnitOfWork($d, false);

        const bounds = { w: colWidth * width, h: rowHeight * height, x: 0, y: 0, r: 0 };

        // TODO: We should look at the viewport and try to center the table in the viewport
        bounds.x = ($d.canvas.w - bounds.w) / 2;
        bounds.y = ($d.canvas.h - bounds.h) / 2;

        const elements: DiagramElement[] = [];

        const table = ElementFactory.node(newid(), 'table', bounds, layer, {}, {});
        elements.push(table);

        for (let r = 0; r < height; r++) {
          const row = ElementFactory.node(
            newid(),
            'tableRow',
            { w: bounds.w, h: rowHeight, x: 0, y: r * rowHeight, r: 0 },
            layer,
            {},
            {}
          );
          table.addChild(row, uow);
          elements.push(row);

          for (let c = 0; c < width; c++) {
            const cell = ElementFactory.node(
              newid(),
              'text',
              { w: colWidth, h: rowHeight, x: c * colWidth, y: 0, r: 0 },
              layer,
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
        assertRegularLayer($d.activeLayer);
        $d.undoManager.addAndExecute(
          new ElementAddUndoableAction(elements, $d, $d.activeLayer, 'Add table')
        );
      })
    );
  }
}

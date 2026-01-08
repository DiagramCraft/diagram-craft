import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Application } from '../../application';
import { TableInsertDialog } from '../TableInsertDialog';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { $tStr } from '@diagram-craft/utils/localize';

export const tableInsertActions = (application: Application) => ({
  TABLE_INSERT: new TableInsertAction(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof tableInsertActions> {}
  }
}

class TableInsertAction extends AbstractAction<undefined, Application> {
  name = $tStr('action.TABLE_INSERT.name', 'Insert Table');

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

        UnitOfWork.executeWithUndo($d, 'Add table', uow => {
          const bounds = { w: colWidth * width, h: rowHeight * height, x: 0, y: 0, r: 0 };

          // Center the table in the current viewport
          const vb = $d.viewBox;
          bounds.x = vb.offset.x + (vb.dimensions.w - bounds.w) / 2;
          bounds.y = vb.offset.y + (vb.dimensions.h - bounds.h) / 2;

          const table = ElementFactory.node(newid(), 'table', bounds, layer, {}, {});
          layer.addElement(table, uow);

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
            }
          }
        });
      })
    );
  }
}

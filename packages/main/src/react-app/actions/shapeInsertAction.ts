import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { assert } from '@diagram-craft/utils/assert';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr } from '@diagram-craft/utils/localize';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Box } from '@diagram-craft/geometry/box';

export const shapeInsertActions = (application: Application) => ({
  SHAPE_INSERT: new ShapeInsertAction(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof shapeInsertActions> {}
  }
}

class ShapeInsertAction extends AbstractAction<undefined, Application> {
  name = $tStr('action.SHAPE_INSERT.name', 'Insert Shape');

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
    this.context.ui?.showDialog({
      id: 'shapeSelect',
      onOk: (stencilId: string) => {
        const diagram = this.context.model.activeDiagram;
        const document = this.context.model.activeDocument;

        const stencil = document.nodeDefinitions.stencilRegistry.getStencil(stencilId);

        assert.present(stencil);
        const layer = diagram.activeLayer;
        assertRegularLayer(layer);

        const v = diagram.viewBox;

        const elements = cloneElements(
          stencil.elementsForPicker(diagram).elements,
          layer as RegularLayer
        );
        const bbox = Box.boundingBox(elements.map(e => e.bounds));

        UnitOfWork.executeWithUndo(diagram, 'Add element', uow => {
          for (const node of elements) {
            layer.addElement(node, uow);

            node.updateMetadata(meta => {
              meta.style = document.styles.activeNodeStylesheet.id;
              meta.textStyle = document.styles.activeTextStylesheet.id;
            }, uow);
          }

          assignNewBounds(
            elements,
            {
              x: v.offset.x + (v.dimensions.w - bbox.w) / 2,
              y: v.offset.y + (v.dimensions.h - bbox.h) / 2
            },

            // TODO: Adjust scale so it always fits into the window
            { x: 1, y: 1 },
            uow
          );
        });

        diagram.document.props.recentStencils.register(stencil.id);

        diagram.selection.setElements(elements);
      },
      onCancel: () => {},
      props: {
        title: 'Insert Shape'
      }
    });
  }
}

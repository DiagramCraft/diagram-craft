import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { assert } from '@diagram-craft/utils/assert';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr } from '@diagram-craft/utils/localize';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Stylesheet } from '@diagram-craft/model/diagramStyles';

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
    const activeLayer = application.model.activeDiagram.activeLayer;
    return ActionCriteria.EventTriggered(
      application.model.activeDiagram.layers,
      'layerStructureChange',
      () => activeLayer.type === 'regular' && !activeLayer.isLocked()
    );
  }

  execute(): void {
    this.context.ui?.showDialog({
      id: 'shapeSelect',
      onOk: (stencilId: string) => {
        const diagram = this.context.model.activeDiagram;
        const document = this.context.model.activeDocument;

        const stencil = document.registry.stencils.getStencil(stencilId);

        assert.present(stencil);
        const layer = diagram.activeLayer;
        assertRegularLayer(layer);

        const v = diagram.viewBox;

        const { bounds, elements } = stencil.elementsForPicker(diagram);
        const newElements = cloneElements(elements, layer as RegularLayer);

        UnitOfWork.executeWithUndo(diagram, 'Add element', uow => {
          const styleManager = diagram.document.styles;
          for (const style of stencil.styles ?? []) {
            if (styleManager.get(style.id) === undefined) {
              const stylesheet = Stylesheet.fromSnapshot(
                style.type,
                style,
                styleManager.crdt.factory
              );
              styleManager.addStylesheet(style.id, stylesheet, uow);
            }
          }

          for (const node of newElements) {
            layer.addElement(node, uow);

            node.updateMetadata(meta => {
              meta.style = document.styles.activeNodeStylesheet.id;
              meta.textStyle = document.styles.activeTextStylesheet.id;
            }, uow);
          }

          assignNewBounds(
            newElements,
            {
              x: v.offset.x + (v.dimensions.w - bounds.w) / 2,
              y: v.offset.y + (v.dimensions.h - bounds.h) / 2
            },

            // TODO: Adjust scale so it always fits into the window
            { x: 1, y: 1 },
            uow
          );
        });

        diagram.document.props.recentStencils.register(stencil.id);

        diagram.selection.setElements(newElements);
      },
      onCancel: () => {},
      props: {
        title: 'Insert Shape'
      }
    });
  }
}

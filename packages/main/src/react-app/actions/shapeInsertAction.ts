import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { assert } from '@diagram-craft/utils/assert';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr } from '@diagram-craft/utils/localize';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { addStencilStylesToDocument } from '@diagram-craft/model/stencilRegistry';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { newid } from '@diagram-craft/utils/id';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { IconifyIconService } from '@diagram-craft/canvas-app/icon/IconifyIconService';
import type { ShapeSelectResult } from '../ShapeSelectDialog';
import { svgAspectRatio } from '@diagram-craft/utils/svg';

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
      onOk: ({ id, type }: ShapeSelectResult) => {
        const diagram = this.context.model.activeDiagram;
        const document = this.context.model.activeDocument;

        switch (type) {
          case 'stencil': {
            const stencil = document.registry.stencils.getStencil(id);

            assert.present(stencil);
            const layer = diagram.activeLayer;
            assertRegularLayer(layer);

            const v = diagram.viewBox;

            const { bounds, elements } = stencil.forCanvas(document.registry);
            const newElements = cloneElements(elements, layer as RegularLayer);

            UnitOfWork.executeWithUndo(diagram, 'Add element', uow => {
              addStencilStylesToDocument(stencil, diagram.document, uow);

              for (const node of newElements) {
                layer.addElement(node, uow);
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
            break;
          }

          case 'icon': {
            const [prefix, iconName] = id.split(':');
            const iconSvc = new IconifyIconService();
            const layer = diagram.activeLayer;
            assertRegularLayer(layer);
            const v = diagram.viewBox;

            iconSvc.fetchIconSvg(prefix!, iconName!).then(svgContent => {
              const h = Math.round(100 * svgAspectRatio(svgContent));
              const node = ElementFactory.node(
                newid(),
                'svg',
                {
                  x: v.offset.x + (v.dimensions.w - 100) / 2,
                  y: v.offset.y + (v.dimensions.h - h) / 2,
                  w: 100,
                  h,
                  r: 0
                },
                layer,
                { custom: { svg: { svgContent } } } as NodeProps,
                {}
              );
              UnitOfWork.executeWithUndo(diagram, 'Add icon', uow => {
                layer.addElement(node, uow);
              });
              diagram.selection.setElements([node]);
            });
            break;
          }
        }
      },
      onCancel: () => {},
      props: {
        title: 'Insert Shape'
      }
    });
  }
}

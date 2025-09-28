import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/helpers/cloneHelper';
import { assert } from '@diagram-craft/utils/assert';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';

export const shapeInsertActions = (application: Application) => ({
  SHAPE_INSERT: new ShapeInsertAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof shapeInsertActions> {}
}

class ShapeInsertAction extends AbstractAction<undefined, Application> {

  getCriteria(application: Application) {
    return ActionCriteria.EventTriggered(
      application.model.activeDiagram,
      'change',
      () => application.model.activeDiagram.activeLayer.type === 'regular'
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
        assertRegularLayer(diagram.activeLayer);

        const v = diagram.viewBox;

        const uow = new UnitOfWork(diagram, true);

        const node = cloneElements(
          [stencil.node(diagram)],
          diagram.activeLayer,
          UnitOfWork.immediate(diagram)
        )[0]!;

        assignNewBounds(
          [node],
          {
            x: v.offset.x + (v.dimensions.w - node.bounds.w) / 2,
            y: v.offset.y + (v.dimensions.h - node.bounds.h) / 2
          },

          // TODO: Adjust scale so it always fits into the window
          { x: 1, y: 1 },
          uow
        );
        node.updateMetadata(meta => {
          meta.style = document.styles.activeNodeStylesheet.id;
          meta.textStyle = document.styles.activeTextStylesheet.id;
        }, uow);

        diagram.activeLayer.addElement(node, uow);

        commitWithUndo(uow, 'Add element');

        diagram.document.props.recentStencils.register(stencil.id);

        diagram.selectionState.toggle(node);
      },
      onCancel: () => {},
      props: {
        title: 'Insert Shape'
      }
    });
  }
}

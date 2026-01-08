import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { Attachment } from '@diagram-craft/model/attachment';
import { newid } from '@diagram-craft/utils/id';
import { Application } from '../../application';
import { ImageInsertDialog } from '../ImageInsertDialog';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { $tStr } from '@diagram-craft/utils/localize';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export const imageInsertActions = (application: Application) => ({
  IMAGE_INSERT: new ImageInsertAction(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof imageInsertActions> {}
  }
}

class ImageInsertAction extends AbstractAction<undefined, Application> {
  name = $tStr('action.IMAGE_INSERT.name', 'Insert Image');

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
    this.context.ui?.showDialog(
      ImageInsertDialog.create(async data => {
        let att: Attachment;
        if (data instanceof Blob) {
          att = await this.context.model.activeDocument.attachments.addAttachment(data);
        } else {
          const res = await fetch(data);
          const blob = await res.blob();
          att = await this.context.model.activeDocument.attachments.addAttachment(blob);
        }

        const img = await createImageBitmap(att.content);
        const { width, height } = img;
        img.close();

        const diagram = this.context.model.activeDiagram;
        const layer = diagram.activeLayer;
        assertRegularLayer(layer);

        // TODO: Improve placement to ensure it's at least partially placed within the current viewport
        const e = ElementFactory.node(
          newid(),
          'rect',
          {
            x: (diagram.bounds.w - width) / 2,
            y: (diagram.bounds.h - height) / 2,
            w: width,
            h: height,
            r: 0
          },
          layer,
          {
            fill: {
              type: 'image',
              image: { id: att.hash, w: width, h: height, fit: 'cover' }
            },
            stroke: {
              enabled: false
            }
          },
          {}
        );

        UnitOfWork.executeWithUndo(diagram, 'Insert image', uow => {
          layer.addElement(e, uow);
          uow.select(diagram, [e.id]);
        });
      })
    );
  }
}

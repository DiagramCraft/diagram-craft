import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { Attachment } from '@diagram-craft/model/attachment';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { Application } from '../../application';
import { ImageInsertDialog } from '../ImageInsertDialog';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';

export const imageInsertActions = (application: Application) => ({
  IMAGE_INSERT: new ImageInsertAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof imageInsertActions> {}
}

class ImageInsertAction extends AbstractAction<undefined, Application> {
  constructor(application: Application) {
    super(application);
  }

  getCriteria(application: Application) {
    return ActionCriteria.EventTriggered(
      application.model.activeDiagram,
      'change',
      () => application.model.activeDiagram.activeLayer.type === 'regular'
    );
  }

  execute(): void {
    this.context.ui?.showDialog(
      ImageInsertDialog.create(async data => {
        let att: Attachment;
        if (data instanceof Blob) {
          att = await this.context.model.activeDocument.attachments.addAttachment(data);
        } else {
          const res = await fetch(data as string);
          const blob = await res.blob();
          att = await this.context.model.activeDocument.attachments.addAttachment(blob);
        }

        const img = await createImageBitmap(att.content);
        const { width, height } = img;
        img.close();

        const e = new DiagramNode(
          newid(),
          'rect',
          {
            // TODO: Improve placement to ensure it's at least partially placed within the current viewport
            x: (this.context.model.activeDiagram.canvas.w - width) / 2,
            y: (this.context.model.activeDiagram.canvas.h - height) / 2,
            w: width,
            h: height,
            r: 0
          },
          this.context.model.activeDiagram.activeLayer,
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

        assertRegularLayer(this.context.model.activeDiagram.activeLayer);
        this.context.model.activeDiagram.undoManager.addAndExecute(
          new ElementAddUndoableAction(
            [e],
            this.context.model.activeDiagram,
            this.context.model.activeDiagram.activeLayer,
            'Insert image'
          )
        );
      })
    );
  }
}

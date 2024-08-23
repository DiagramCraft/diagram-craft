import { State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { Attachment } from '@diagram-craft/model/attachment';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';

export const imageInsertActions = (state: State) => ({
  IMAGE_INSERT: new ImageInsertAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof imageInsertActions> {}
}

class ImageInsertAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
    this.addCriterion(diagram, 'change', () => diagram.activeLayer.type === 'regular');
  }

  execute(context: ActionContext): void {
    context.applicationTriggers?.showDialog?.({
      name: 'imageInsert',
      onOk: async data => {
        let att: Attachment;
        if (data instanceof Blob) {
          att = await this.diagram.document.attachments.addAttachment(data);
        } else {
          const res = await fetch(data as string);
          const blob = await res.blob();
          att = await this.diagram.document.attachments.addAttachment(blob);
        }

        const img = await createImageBitmap(att.content);
        const { width, height } = img;
        img.close();

        const e = new DiagramNode(
          newid(),
          'rect',
          {
            // TODO: Improve placement to ensure it's at least partially placed within the current viewport
            x: (this.diagram.canvas.w - width) / 2,
            y: (this.diagram.canvas.h - height) / 2,
            w: width,
            h: height,
            r: 0
          },
          this.diagram,
          this.diagram.activeLayer,
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

        assertRegularLayer(this.diagram.activeLayer);
        this.diagram.undoManager.addAndExecute(
          new ElementAddUndoableAction([e], this.diagram, this.diagram.activeLayer, 'Insert image')
        );
      },
      onCancel: () => {}
    });
  }
}

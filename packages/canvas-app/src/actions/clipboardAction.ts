import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import {
  AbstractAction,
  ActionContext,
  ActionCriteria,
  BaseActionArgs
} from '@diagram-craft/canvas/action';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { Clipboard } from '../clipboard';
import {
  ElementsPasteHandler,
  ImagePasteHandler,
  TextPasteHandler
} from '../clipboardPasteHandlers';
import { ELEMENTS_CONTENT_TYPE } from '../clipboardConstants';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof clipboardActions> {}
  }
}

export const clipboardActions = (context: ActionContext) => ({
  CLIPBOARD_COPY: new ClipboardCopyAction('copy', context),
  CLIPBOARD_CUT: new ClipboardCopyAction('cut', context),
  CLIPBOARD_PASTE: new ClipboardPasteAction(context)
});

const CLIPBOARD = Clipboard.get();

const PASTE_HANDLERS = {
  'image/png': new ImagePasteHandler(),
  'image/jpeg': new ImagePasteHandler(),
  'text/plain': new TextPasteHandler(),
  [ELEMENTS_CONTENT_TYPE]: new ElementsPasteHandler()
};

export class ClipboardPasteAction extends AbstractAction<BaseActionArgs> {
  name = $tStr('action.CLIPBOARD_PASTE.name', 'Paste');
  layer: RegularLayer | undefined;

  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(context.model.activeDiagram, 'diagramChange', () => {
      const activeLayer = context.model.activeDiagram.activeLayer;
      if (activeLayer instanceof RegularLayer) {
        this.layer = activeLayer;
        return true;
      } else {
        this.layer = undefined;
        return false;
      }
    });
  }

  execute(context: BaseActionArgs) {
    CLIPBOARD.read().then(clip => {
      for (const c of clip) {
        for (const [contentType, handler] of Object.entries(PASTE_HANDLERS)) {
          if (c.type.includes(contentType)) {
            c.blob.then(blob =>
              handler.paste(blob, this.context.model.activeDiagram, this.layer!, context)
            );
            return;
          }
        }
      }
    });

    this.emit('actionTriggered', {});
  }
}

export class ClipboardCopyAction extends AbstractSelectionAction {
  name: TranslatedString;

  constructor(
    private readonly mode: 'copy' | 'cut',
    context: ActionContext
  ) {
    super(context, MultipleType.Both, ElementType.Both, ['regular']);
    this.name =
      mode === 'copy'
        ? $tStr('action.CLIPBOARD_COPY.name', 'Copy')
        : $tStr('action.CLIPBOARD_CUT.name', 'Cut');
  }

  execute(): void {
    CLIPBOARD.write(
      JSON.stringify(
        this.context.model.activeDiagram.selection.elements.map(e => serializeDiagramElement(e))
      ),
      ELEMENTS_CONTENT_TYPE,
      this.mode
    ).then(() => {
      if (this.mode === 'cut') {
        this.deleteSelection();
      }

      this.emit('actionTriggered', {});
    });
  }

  private deleteSelection() {
    const diagram = this.context.model.activeDiagram;
    UnitOfWork.execute(diagram, {}, uow => {
      for (const element of diagram.selection.elements) {
        assertRegularLayer(element.layer);
        element.layer.removeElement(element, uow);
      }
    });
    diagram.selection.clear();
  }
}

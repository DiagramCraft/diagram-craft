import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import {
  AbstractAction,
  ActionContext,
  ActionCriteria,
  BaseActionArgs
} from '@diagram-craft/canvas/action';
import { UndoableAction } from '@diagram-craft/model/undoManager';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { Clipboard, ELEMENTS_CONTENT_TYPE } from '../clipboard';
import { PASTE_HANDLERS, PasteHandler } from '../clipboardPasteHandlers';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

declare global {
  interface ActionMap extends ReturnType<typeof clipboardActions> {}
}

export const clipboardActions = (context: ActionContext) => ({
  CLIPBOARD_COPY: new ClipboardCopyAction('copy', context),
  CLIPBOARD_CUT: new ClipboardCopyAction('cut', context),
  CLIPBOARD_PASTE: new ClipboardPasteAction(context)
});

const CLIPBOARD = Clipboard.get();

export class PasteUndoableAction implements UndoableAction {
  description = 'Paste';

  constructor(
    private readonly elements: DiagramElement[],
    private readonly diagram: Diagram,
    private readonly layer: RegularLayer
  ) {}

  undo(uow: UnitOfWork) {
    this.elements.forEach(e => {
      assertRegularLayer(e.layer);
      e.layer.removeElement(e, uow);
    });

    this.diagram.selectionState.setElements(
      this.diagram.selectionState.elements.filter(e => !this.elements.includes(e))
    );

    PasteHandler.clearPastePoint();
  }

  redo(uow: UnitOfWork) {
    this.elements.forEach(e => {
      this.layer.addElement(e, uow);
    });
  }
}

export class ClipboardPasteAction extends AbstractAction<BaseActionArgs> {
  layer: RegularLayer | undefined;

  constructor(context: ActionContext) {
    super(context);
  }

  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(context.model.activeDiagram, 'change', () => {
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
  constructor(
    private readonly mode: 'copy' | 'cut',
    context: ActionContext
  ) {
    super(context, MultipleType.Both, ElementType.Both, ['regular']);
  }

  execute(): void {
    CLIPBOARD.write(
      JSON.stringify(
        this.context.model.activeDiagram.selectionState.elements.map(e =>
          serializeDiagramElement(e)
        )
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
    UnitOfWork.execute(diagram, uow => {
      for (const element of diagram.selectionState.elements) {
        assertRegularLayer(element.layer);
        element.layer.removeElement(element, uow);
      }
    });
    diagram.selectionState.clear();
  }
}

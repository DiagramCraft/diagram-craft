import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, BaseActionArgs } from '@diagram-craft/canvas/action';
import { UndoableAction } from '@diagram-craft/model/undoManager';
import { assertRegularLayer, RegularLayer } from '@diagram-craft/model/diagramLayer';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { Clipboard, ELEMENTS_CONTENT_TYPE } from '../clipboard';
import { PASTE_HANDLERS, PasteHandler } from '../clipboardPasteHandlers';

declare global {
  interface ActionMap extends ReturnType<typeof clipboardActions> {}
}

export const clipboardActions = (state: ActionConstructionParameters) => ({
  CLIPBOARD_COPY: new ClipboardCopyAction('copy', state.diagram),
  CLIPBOARD_CUT: new ClipboardCopyAction('cut', state.diagram),
  CLIPBOARD_PASTE: new ClipboardPasteAction(state.diagram)
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

  constructor(protected readonly diagram: Diagram) {
    super();
    diagram.on('change', () => {
      const activeLayer = diagram.activeLayer;
      if (activeLayer instanceof RegularLayer) {
        this.enabled = true;
        this.layer = activeLayer;
      } else {
        this.enabled = false;
        this.layer = undefined;
      }
      this.emit('actionChanged');
    });
  }

  execute(context: BaseActionArgs) {
    CLIPBOARD.read().then(clip => {
      for (const c of clip) {
        for (const [contentType, handler] of Object.entries(PASTE_HANDLERS)) {
          if (c.type.includes(contentType)) {
            c.blob.then(blob => handler.paste(blob, this.diagram, this.layer!, context));
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
    diagram: Diagram
  ) {
    super(diagram, MultipleType.Both, ElementType.Both, ['regular']);
  }

  execute(): void {
    CLIPBOARD.write(
      JSON.stringify(this.diagram.selectionState.elements.map(e => serializeDiagramElement(e))),
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
    UnitOfWork.execute(this.diagram, uow => {
      for (const element of this.diagram.selectionState.elements) {
        assertRegularLayer(element.layer);
        element.layer.removeElement(element, uow);
      }
    });
    this.diagram.selectionState.clear();
  }
}

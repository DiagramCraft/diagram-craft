import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { EventEmitter } from '../../utils/event.ts';
import { Action, ActionContext, ActionEvents } from '../keyMap.ts';
import {
  deserializeDiagramElements,
  SerializedElement,
  serializeDiagramElement
} from '../../model-viewer/serialization.ts';
import { newid } from '../../utils/id.ts';
import { Box } from '../../geometry/box.ts';
import { DiagramElement, DiagramNode } from '../../model-viewer/diagramNode.ts';
import { Point } from '../../geometry/point.ts';
import { UndoableAction } from '../../model-editor/undoManager.ts';
import { Diagram } from '../../model-viewer/diagram.ts';

declare global {
  interface ActionMap {
    CLIPBOARD_COPY: ClipboardCopyAction;
    CLIPBOARD_PASTE: ClipboardPasteAction;
    CLIPBOARD_CUT: ClipboardCopyAction;
  }
}

export class PasteUndoableAction implements UndoableAction {
  description = 'Paste';

  constructor(
    private readonly elements: DiagramElement[],
    private readonly diagram: Diagram
  ) {}

  undo() {
    this.elements.forEach(e => {
      this.diagram.removeElement(e);
    });
  }

  redo() {
    this.elements.forEach(e => {
      this.diagram.addElement(e);
    });
  }
}

abstract class AbstractClipboardPasteAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  protected constructor(protected readonly diagram: EditableDiagram) {
    super();
  }

  abstract execute(context: ActionContext): void;

  protected pasteElements(elements: SerializedElement[], context: ActionContext): Point {
    const nodeIdMapping = new Map<string, string>();

    // TODO: This is not correct if pasting a free edge
    const bb = Box.boundingBox(
      elements.filter(e => e.type === 'node').map(e => (e as DiagramNode).bounds)
    );

    if (!context.point) {
      context.point = { x: bb.pos.x + 10, y: bb.pos.y + 10 };
    }

    for (const e of elements) {
      if (e.type === 'node') {
        const newId = newid();
        nodeIdMapping.set(e.id, newId);
        e.id = newId;

        const dx = context.point.x - bb.pos.x;
        const dy = context.point.y - bb.pos.y;
        const s = Box.asMutableSnapshot(e.bounds);
        s.set('pos', {
          x: s.get('pos')!.x + dx,
          y: s.get('pos')!.y + dy
        });
        e.bounds = s.getSnapshot();
      }
    }

    for (const e of elements) {
      if (e.type === 'edge') {
        if ('node' in e.start) {
          e.start.node = { id: nodeIdMapping.get(e.start.node.id)! };
        }
        if ('node' in e.end) {
          e.end.node = { id: nodeIdMapping.get(e.end.node.id)! };
        }
      }
    }

    const newElements = deserializeDiagramElements(elements, {}, {});

    this.diagram.undoManager.addAndExecute(new PasteUndoableAction(newElements, this.diagram));
    this.diagram.selectionState.setElements(newElements, true);

    return context.point;
  }

  protected pasteText(content: string, context: ActionContext): Point {
    console.log('paste text not implemented yet "', content, '"', context);

    const $clipboard: HTMLTextAreaElement = document.getElementById(
      'clipboard'
    )! as HTMLTextAreaElement;
    console.log($clipboard.value);

    return context.point!;
  }
}

const PREFIX = 'application/x-diagram-craft-selection;';

export class ClipboardPasteAction extends AbstractClipboardPasteAction {
  #lastPasteHash?: string;
  #lastPastePoint: Point | undefined = undefined;

  constructor(protected readonly diagram: EditableDiagram) {
    super(diagram);
  }

  execute(context: ActionContext) {
    const $clipboard: HTMLTextAreaElement = document.getElementById(
      'clipboard'
    )! as HTMLTextAreaElement;
    $clipboard.value = '';

    $clipboard?.focus();
    document.execCommand('paste');

    window.setTimeout(() => {
      let content = $clipboard.value;

      if (content.trim() === '') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content = (document.body as any)._diagramCraftClipboard;
      }

      if (content === this.#lastPasteHash) {
        this.#lastPastePoint = {
          x: this.#lastPastePoint!.x + 10,
          y: this.#lastPastePoint!.y + 10
        };
      } else {
        this.#lastPasteHash = content;
        this.#lastPastePoint = undefined;
      }

      if (content.startsWith(PREFIX)) {
        const elements = JSON.parse(content.substring(PREFIX.length));
        this.#lastPastePoint = this.pasteElements(elements, {
          point: this.#lastPastePoint,
          ...context
        });
      } else {
        this.#lastPastePoint = this.pasteText(content, { point: this.#lastPastePoint, ...context });
      }
    }, 10);

    this.emit('actiontriggered', { action: this });
  }
}

export class ClipboardCopyAction extends AbstractSelectionAction {
  enabled = true;

  constructor(
    protected readonly diagram: EditableDiagram,
    private readonly mode: 'copy' | 'cut'
  ) {
    super(diagram);
  }

  execute(): void {
    const $clipboard: HTMLTextAreaElement = document.getElementById(
      'clipboard'
    )! as HTMLTextAreaElement;
    $clipboard.value =
      'application/x-diagram-craft-selection;' +
      JSON.stringify(this.diagram.selectionState.elements.map(e => serializeDiagramElement(e)));
    $clipboard?.focus();
    $clipboard?.select();

    document.execCommand(this.mode);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document.body as any)._diagramCraftClipboard = $clipboard.value;

    if (this.mode === 'cut') {
      this.deleteSelection();
    }

    this.emit('actiontriggered', { action: this });
  }

  private deleteSelection() {
    for (const element of this.diagram.selectionState.elements) {
      this.diagram.removeElement(element);
    }
    this.diagram.selectionState.clear();
  }
}

import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { ActionMapFactory, State } from '../keyMap.ts';
import { isConnected, serializeDiagramElement } from '../../model/serialization/serialize.ts';
import { newid } from '../../utils/id.ts';
import { Box } from '../../geometry/box.ts';
import { DiagramElement } from '../../model/diagramElement.ts';
import { Point } from '../../geometry/point.ts';
import { UndoableAction } from '../../model/undoManager.ts';
import { Diagram } from '../../model/diagram.ts';
import { precondition } from '../../utils/assert.ts';
import { Layer } from '../../model/diagramLayer.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { SerializedElement } from '../../model/serialization/types.ts';
import { deserializeDiagramElements } from '../../model/serialization/deserialize.ts';
import { AbstractAction, ActionContext } from '../action.ts';

declare global {
  interface ActionMap {
    CLIPBOARD_COPY: ClipboardCopyAction;
    CLIPBOARD_PASTE: ClipboardPasteAction;
    CLIPBOARD_CUT: ClipboardCopyAction;
  }
}

export const clipboardActions: ActionMapFactory = (state: State) => ({
  CLIPBOARD_COPY: new ClipboardCopyAction(state.diagram, 'copy'),
  CLIPBOARD_CUT: new ClipboardCopyAction(state.diagram, 'cut'),
  CLIPBOARD_PASTE: new ClipboardPasteAction(state.diagram)
});

const OFFSET = 10;
const PREFIX = 'application/x-diagram-craft-selection;';

export class PasteUndoableAction implements UndoableAction {
  description = 'Paste';
  private layer: Layer;

  constructor(
    private readonly elements: DiagramElement[],
    private readonly diagram: Diagram
  ) {
    this.layer = this.diagram.layers.active;
  }

  undo() {
    UnitOfWork.execute(this.diagram, uow => {
      this.elements.forEach(e => {
        e.layer.removeElement(e, uow);
      });
    });
  }

  redo() {
    UnitOfWork.execute(this.diagram, uow => {
      this.elements.forEach(e => {
        this.layer.addElement(e, uow);
      });
    });
  }
}

abstract class AbstractClipboardPasteAction extends AbstractAction {
  protected constructor(protected readonly diagram: Diagram) {
    super();
  }

  abstract execute(context: ActionContext): void;

  protected pasteElements(elements: SerializedElement[], context: ActionContext): Point {
    const nodeIdMapping = new Map<string, string>();

    const bb = Box.boundingBox(
      elements.map(e => {
        if (e.type === 'node') return e.bounds;
        else {
          precondition.is.present(e.start.position);
          precondition.is.present(e.end.position);
          return Box.fromCorners(e.start.position, e.end.position);
        }
      })
    );

    if (!context.point) {
      context.point = { x: bb.x + OFFSET, y: bb.y + OFFSET };
    }

    for (const e of elements) {
      if (e.type === 'node') {
        const newId = newid();
        nodeIdMapping.set(e.id, newId);
        e.id = newId;

        const adjustPosition = this.adjustPosition(e.bounds, context, bb);
        e.bounds = {
          ...e.bounds,
          x: adjustPosition.x,
          y: adjustPosition.y
        };
      } else {
        e.id = newid();
        if (!isConnected(e.start)) {
          e.start.position = this.adjustPosition(e.start.position, context, bb);
        }
        if (!isConnected(e.end)) {
          e.end.position = this.adjustPosition(e.end.position, context, bb);
        }
      }
    }

    for (const e of elements) {
      if (e.type === 'edge') {
        if ('node' in e.start) {
          const newId = nodeIdMapping.get(e.start.node.id);
          if (newId) {
            e.start.node = { id: newId };
          } else {
            e.start = { position: e.start.position! };
          }
        }
        if ('node' in e.end) {
          const newId = nodeIdMapping.get(e.end.node.id);
          if (newId) {
            e.end.node = { id: newId };
          } else {
            e.end = { position: e.end.position! };
          }
        }
      }
    }

    const newElements = deserializeDiagramElements(
      elements,
      this.diagram,
      this.diagram.layers.active,
      {},
      {}
    );

    this.diagram.undoManager.addAndExecute(new PasteUndoableAction(newElements, this.diagram));
    this.diagram.selectionState.setElements(newElements);

    return context.point;
  }

  private adjustPosition(s: Point, context: ActionContext, bb: Box) {
    return {
      x: s.x + (context.point!.x - bb.x),
      y: s.y + (context.point!.y - bb.y)
    };
  }

  protected pasteText(content: string, context: ActionContext): Point {
    console.log('paste text not implemented yet "', content, '"', context);

    return context.point!;
  }
}

export class ClipboardPasteAction extends AbstractClipboardPasteAction {
  #lastPasteHash?: string;
  #lastPastePoint: Point | undefined = undefined;

  constructor(protected readonly diagram: Diagram) {
    super(diagram);
  }

  execute(context: ActionContext) {
    const $clipboard: HTMLTextAreaElement = document.getElementById(
      'clipboard'
    )! as HTMLTextAreaElement;
    $clipboard.value = '';
    $clipboard.focus();

    document.execCommand('paste');

    window.setTimeout(() => {
      let content = $clipboard.value;

      if (content.trim() === '') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content = (document.body as any)._diagramCraftClipboard;
      }

      if (content === this.#lastPasteHash) {
        this.#lastPastePoint = {
          x: this.#lastPastePoint!.x + OFFSET,
          y: this.#lastPastePoint!.y + OFFSET
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
  constructor(
    protected readonly diagram: Diagram,
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
    $clipboard.focus();
    $clipboard.select();

    document.execCommand(this.mode);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document.body as any)._diagramCraftClipboard = $clipboard.value;

    if (this.mode === 'cut') {
      this.deleteSelection();
    }

    this.emit('actiontriggered', { action: this });
  }

  private deleteSelection() {
    UnitOfWork.execute(this.diagram, uow => {
      for (const element of this.diagram.selectionState.elements) {
        element.layer.removeElement(element, uow);
      }
    });
    this.diagram.selectionState.clear();
  }
}

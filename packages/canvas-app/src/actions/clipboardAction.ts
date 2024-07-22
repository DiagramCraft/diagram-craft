import { AbstractSelectionAction } from './abstractSelectionAction';
import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { UndoableAction } from '@diagram-craft/model/undoManager';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { SerializedElement } from '@diagram-craft/model/serialization/types';
import {
  isSerializedEndpointFree,
  serializeDiagramElement
} from '@diagram-craft/model/serialization/serialize';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { precondition } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { Browser } from '@diagram-craft/canvas/browser';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { hash64 } from '@diagram-craft/utils/hash';

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
const ELEMENTS_CONTENT_TYPE = 'application/x-diagram-craft-selection';

export class PasteUndoableAction implements UndoableAction {
  description = 'Paste';
  private layer: Layer;

  constructor(
    private readonly elements: DiagramElement[],
    private readonly diagram: Diagram
  ) {
    this.layer = this.diagram.layers.active;
  }

  undo(uow: UnitOfWork) {
    this.elements.forEach(e => {
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

type ClipboardItem = {
  type: string;
  blob: Promise<Blob>;
};

type Clipboard = {
  read: () => Promise<ClipboardItem[]>;
  write: (content: string, contentType: string, mode: 'copy' | 'cut') => Promise<void>;
};

const PREFIX = ELEMENTS_CONTENT_TYPE + ';';

/**
 * Note: There is special handling of application/x-diagram-craft-selection here,
 * as it's not possible to write arbitrary content types to the clipboard.
 * Instead, we write it using text/plain with a prefix in the content
 */
const HTML5Clipboard: Clipboard = {
  read: async (): Promise<ClipboardItem[]> => {
    const clip = await navigator.clipboard.read();
    const dest: ClipboardItem[] = [];

    for (const c of clip) {
      const types = c.types;

      for (const type of types) {
        if (type === 'text/plain') {
          const blob = await c.getType(type);
          const text = await blob.text();
          if (text.startsWith(PREFIX)) {
            dest.push({
              type: ELEMENTS_CONTENT_TYPE,
              blob: Promise.resolve(
                new Blob([text.slice(PREFIX.length)], { type: ELEMENTS_CONTENT_TYPE })
              )
            });
            continue;
          }
        }
        dest.push({ type, blob: c.getType(type) });
      }
    }

    return dest;
  },
  write: async (content: string, contentType: string, _mode: 'copy' | 'cut') => {
    if (contentType === ELEMENTS_CONTENT_TYPE) {
      await navigator.clipboard.write([
        new ClipboardItem({
          ['text/plain']: new Blob([PREFIX + content], { type: 'text/plain' })
        })
      ]);
    } else {
      await navigator.clipboard.write([
        new ClipboardItem({
          [contentType]: new Blob([content], { type: contentType })
        })
      ]);
    }
  }
};

/**
 * The idea here is to use a hidden textarea as the source and target of clipboard operations.
 * As such, it is limited to text payloads. Similar to the HTML5Clipboard, special handling
 * is required for application/x-diagram-craft-selection - similar to HTML5Clipboard, the
 * content is prefixed to allow for discrimination on paste
 */
const TextareaClipboard: Clipboard = {
  read: async (): Promise<ClipboardItem[]> => {
    const $clipboard = document.getElementById('clipboard')! as HTMLTextAreaElement;
    $clipboard.value = '';
    $clipboard.focus();

    document.execCommand('paste');

    return new Promise<ClipboardItem[]>(resolve => {
      window.setTimeout(() => {
        let content = $clipboard.value;

        if (content.trim() === '') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content = (document.body as any)._diagramCraftClipboard;
        }

        if (content.startsWith(PREFIX)) {
          resolve([
            {
              type: ELEMENTS_CONTENT_TYPE,
              blob: Promise.resolve(
                new Blob([content.slice(PREFIX.length)], { type: ELEMENTS_CONTENT_TYPE })
              )
            }
          ]);
        } else {
          resolve([
            {
              type: 'text/plain',
              blob: Promise.resolve(new Blob([content], { type: 'text/plain' }))
            }
          ]);
        }
      }, 10);
    });
  },
  write: async (content: string, contentType: string, mode: 'copy' | 'cut') => {
    const $clipboard: HTMLTextAreaElement = document.getElementById(
      'clipboard'
    )! as HTMLTextAreaElement;
    if (contentType === ELEMENTS_CONTENT_TYPE) {
      $clipboard.value = PREFIX + content;
    } else {
      $clipboard.value = content;
    }
    $clipboard.focus();
    $clipboard.select();

    document.execCommand(mode);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document.body as any)._diagramCraftClipboard = $clipboard.value;
  }
};

const Clipboard = {
  get(): Clipboard {
    if (Browser.isFirefox()) {
      return TextareaClipboard;
    } else {
      return HTML5Clipboard;
    }
  }
};

abstract class PasteHandler {
  static lastPasteHash?: string;
  static lastPastePoint: Point | undefined = undefined;

  static clearPastePoint() {
    PasteHandler.lastPasteHash = undefined;
    PasteHandler.lastPastePoint = undefined;
  }

  protected async hash(blob: Blob) {
    return hash64(new Uint8Array(await blob.arrayBuffer()));
  }

  protected async getPastePoint(hash: string) {
    if (hash === PasteHandler.lastPasteHash) {
      return {
        x: PasteHandler.lastPastePoint!.x + OFFSET,
        y: PasteHandler.lastPastePoint!.y + OFFSET
      };
    } else {
      return undefined;
    }
  }

  protected registerPastePoint(hash: string, point: Point) {
    PasteHandler.lastPasteHash = hash;
    PasteHandler.lastPastePoint = point;
  }

  abstract paste(content: Blob, diagram: Diagram, context: ActionContext): Promise<void>;
}

class ImagePasteHandler extends PasteHandler {
  async paste(content: Blob, diagram: Diagram, context: ActionContext) {
    const hash = await this.hash(content);

    const point = (await this.getPastePoint(hash)) ?? context.point!;

    const att = await diagram.document.attachments.addAttachment(content);
    const img = await createImageBitmap(att.content);

    const newElements = [
      new DiagramNode(
        newid(),
        'rect',
        { x: point!.x, y: point!.y, w: img.width, h: img.height, r: 0 },
        diagram,
        diagram.layers.active,
        {
          fill: {
            type: 'image',
            image: { id: att.hash, w: img.width, h: img.height, fit: 'cover' }
          },
          stroke: {
            enabled: false
          }
        }
      )
    ];

    diagram.undoManager.addAndExecute(new PasteUndoableAction(newElements, diagram));
    diagram.selectionState.setElements(newElements);

    this.registerPastePoint(hash, point);
  }
}

class TextPasteHandler extends PasteHandler {
  async paste(content: Blob, diagram: Diagram, context: ActionContext) {
    const hash = await this.hash(content);

    const point = (await this.getPastePoint(hash)) ?? context.point!;

    const text = await content.text();
    const newElements = [
      new DiagramNode(
        newid(),
        'text',
        { x: point!.x, y: point!.y, w: 200, h: 20, r: 0 },
        diagram,
        diagram.layers.active,
        {
          stroke: {
            enabled: false
          },
          text: {
            text
          }
        }
      )
    ];

    diagram.undoManager.addAndExecute(new PasteUndoableAction(newElements, diagram));
    diagram.selectionState.setElements(newElements);

    this.registerPastePoint(hash, point);
  }
}

class ElementsPasteHandler extends PasteHandler {
  async paste(content: Blob, diagram: Diagram, context: ActionContext) {
    const hash = await this.hash(content);

    const text = await content.text();

    const elements = JSON.parse(text) as SerializedElement[];

    const bounds = Box.boundingBox(
      elements.map(e => {
        if (e.type === 'node') return e.bounds;
        else {
          precondition.is.present(e.start.position);
          precondition.is.present(e.end.position);
          return Box.fromCorners(e.start.position, e.end.position);
        }
      })
    );

    let point = await this.getPastePoint(hash);
    if (!point) {
      if (context.source !== 'keyboard') {
        point = context.point;
      } else {
        point = { x: bounds.x + OFFSET, y: bounds.y + OFFSET };
      }
    }
    point ??= context.point!;

    const nodeIdMapping = new Map<string, string>();

    for (const e of elements) {
      if (e.type === 'node') {
        const newId = newid();
        nodeIdMapping.set(e.id, newId);
        e.id = newId;

        const adjustPosition = this.adjustPosition(e.bounds, point, bounds);
        e.bounds = {
          ...e.bounds,
          x: adjustPosition.x,
          y: adjustPosition.y
        };
      } else {
        e.id = newid();
        if (isSerializedEndpointFree(e.start)) {
          e.start.position = this.adjustPosition(e.start.position, point, bounds);
        }
        if (isSerializedEndpointFree(e.end)) {
          e.end.position = this.adjustPosition(e.end.position, point, bounds);
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
      diagram,
      diagram.layers.active,
      {},
      {}
    );

    diagram.undoManager.addAndExecute(new PasteUndoableAction(newElements, diagram));
    diagram.selectionState.setElements(newElements);

    this.registerPastePoint(hash, point);
  }

  private adjustPosition(s: Point, pastePoint: Point, bb: Box) {
    return {
      x: s.x + (pastePoint.x - bb.x),
      y: s.y + (pastePoint.y - bb.y)
    };
  }
}

const HANDLERS = {
  'image/png': new ImagePasteHandler(),
  'image/jpeg': new ImagePasteHandler(),
  'text/plain': new TextPasteHandler(),
  [ELEMENTS_CONTENT_TYPE]: new ElementsPasteHandler()
};

export class ClipboardPasteAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext) {
    Clipboard.get()
      .read()
      .then(clip => {
        for (const c of clip) {
          for (const [contentType, handler] of Object.entries(HANDLERS)) {
            if (c.type.includes(contentType)) {
              c.blob.then(blob => handler.paste(blob, this.diagram, context));
              return;
            }
          }
        }
      });

    this.emit('actiontriggered', { action: this });
  }
}

export class ClipboardCopyAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    private readonly mode: 'copy' | 'cut'
  ) {
    super(diagram, 'both');
  }

  execute(): void {
    Clipboard.get()
      .write(
        JSON.stringify(this.diagram.selectionState.elements.map(e => serializeDiagramElement(e))),
        ELEMENTS_CONTENT_TYPE,
        this.mode
      )
      .then(() => {
        if (this.mode === 'cut') {
          this.deleteSelection();
        }

        this.emit('actiontriggered', { action: this });
      });
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

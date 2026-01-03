import { Point } from '@diagram-craft/geometry/point';
import { hash64 } from '@diagram-craft/utils/hash';
import { Diagram } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';
import { SerializedElement } from '@diagram-craft/model/serialization/serializedTypes';
import { Box } from '@diagram-craft/geometry/box';
import { precondition, VerifyNotReached } from '@diagram-craft/utils/assert';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { BaseActionArgs } from '@diagram-craft/canvas/action';
import { isSerializedEndpointFree } from '@diagram-craft/model/serialization/utils';
import { UndoableAction } from '@diagram-craft/model/undoManager';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

/* This contains paste handlers which are the code that is executed once
 * an item is pasted. Depending on the type of item pasted (image, node, etc)
 * different handlers are used */

/**
 * When pasting the same item repeatedly, we want to offset the pasted item
 * so that it doesn't overlap with the previous one. This constant defines
 * the offset amount.
 */
const OFFSET = 10;

export abstract class PasteHandler {
  static lastPasteHash?: string;
  static lastPastePoint: Point | undefined = undefined;

  /**
   * Clears the state used for repeated pasting and offsetting
   */
  clearPastePoint() {
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

  abstract paste(
    content: Blob,
    diagram: Diagram,
    layer: RegularLayer,
    context: BaseActionArgs
  ): Promise<void>;
}

export class ImagePasteHandler extends PasteHandler {
  async paste(content: Blob, diagram: Diagram, layer: RegularLayer, context: BaseActionArgs) {
    const hash = await this.hash(content);

    const point = (await this.getPastePoint(hash)) ?? context.point!;

    const att = await diagram.document.attachments.addAttachment(content);
    const img = await createImageBitmap(att.content);

    const newElements = [
      ElementFactory.node(
        newid(),
        'rect',
        { x: point.x, y: point.y, w: img.width, h: img.height, r: 0 },
        layer,
        {
          fill: {
            type: 'image',
            image: { id: att.hash, w: img.width, h: img.height, fit: 'cover' }
          },
          stroke: {
            enabled: false
          }
        },
        {}
      )
    ];

    diagram.undoManager.addAndExecute(new PasteUndoableAction(newElements, diagram, layer, this));
    diagram.selection.setElements(newElements);

    this.registerPastePoint(hash, point);
  }
}

export class TextPasteHandler extends PasteHandler {
  async paste(content: Blob, diagram: Diagram, layer: RegularLayer, context: BaseActionArgs) {
    const hash = await this.hash(content);

    const point = (await this.getPastePoint(hash)) ?? context.point!;

    const text = await content.text();
    const newElements = [
      ElementFactory.node(
        newid(),
        'text',
        { x: point.x, y: point.y, w: 200, h: 20, r: 0 },
        layer,
        {
          stroke: {
            enabled: false
          }
        },
        {},
        { text: text }
      )
    ];

    diagram.undoManager.addAndExecute(new PasteUndoableAction(newElements, diagram, layer, this));
    diagram.selection.setElements(newElements);

    this.registerPastePoint(hash, point);
  }
}

export class ElementsPasteHandler extends PasteHandler {
  async paste(content: Blob, diagram: Diagram, layer: RegularLayer, context: BaseActionArgs) {
    const hash = await this.hash(content);

    const text = await content.text();

    const elements = JSON.parse(text) as SerializedElement[];

    const bounds = Box.boundingBox(
      elements.map(e => {
        if (e.type === 'node' || e.type === 'delegating-node') return e.bounds;
        else if (e.type === 'edge' || e.type === 'delegating-edge') {
          precondition.is.present(e.start.position);
          precondition.is.present(e.end.position);
          return Box.fromCorners(e.start.position, e.end.position);
        } else {
          throw new VerifyNotReached();
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
      if (e.type === 'node' || e.type === 'delegating-node') {
        const newId = newid();
        nodeIdMapping.set(e.id, newId);
        e.id = newId;

        const adjustPosition = this.adjustPosition(e.bounds, point, bounds);
        e.bounds = {
          ...e.bounds,
          x: adjustPosition.x,
          y: adjustPosition.y
        };
      } else if (e.type === 'edge' || e.type === 'delegating-edge') {
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

    const newElements = UnitOfWork.execute(diagram, uow =>
      deserializeDiagramElements(elements, layer, uow)
    );

    diagram.undoManager.addAndExecute(new PasteUndoableAction(newElements, diagram, layer, this));
    diagram.selection.setElements(newElements);

    this.registerPastePoint(hash, point);
  }

  private adjustPosition(s: Point, pastePoint: Point, bb: Box) {
    return {
      x: s.x + (pastePoint.x - bb.x),
      y: s.y + (pastePoint.y - bb.y)
    };
  }
}

class PasteUndoableAction implements UndoableAction {
  description = 'Paste';

  constructor(
    private readonly elements: DiagramElement[],
    private readonly diagram: Diagram,
    private readonly layer: RegularLayer,
    private readonly pasteHandler: PasteHandler
  ) {}

  undo(uow: UnitOfWork) {
    this.elements.forEach(e => {
      assertRegularLayer(e.layer);
      e.layer.removeElement(e, uow);
    });

    this.diagram.selection.setElements(
      this.diagram.selection.elements.filter(e => !this.elements.includes(e))
    );

    this.pasteHandler.clearPastePoint();
  }

  redo(uow: UnitOfWork) {
    this.elements.forEach(e => {
      this.layer.addElement(e, uow);
    });
  }
}

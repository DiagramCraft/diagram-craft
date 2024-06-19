import { Diagram } from '@diagram-craft/model/diagram';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import { SerializedElement } from '@diagram-craft/model/serialization/types';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { Extent } from '@diagram-craft/geometry/extent';
import { newid } from '@diagram-craft/utils/id';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { Point } from '@diagram-craft/geometry/point';

type ElementsDraggable = {
  elements: Array<SerializedElement>;
  attachments: Record<string, string>;
  dimensions: Extent;
};

const assignNewIds = (droppedElements: readonly DiagramElement[]) => {
  for (const e of droppedElements) {
    e.id = newid();
    if (isNode(e)) {
      assignNewIds(e.children);
    }
  }
};

const assignNewBounds = (
  droppedElements: readonly DiagramElement[],
  bounds: Box,
  point: Point,
  scaleX: number,
  scaleY: number,
  $d: Diagram
) => {
  for (const e of droppedElements) {
    e.setBounds(
      {
        x: (e.bounds.x - bounds.x) * scaleX + point.x,
        y: (e.bounds.y - bounds.y) * scaleY + point.y,
        w: e.bounds.w * scaleX,
        h: e.bounds.h * scaleY,
        r: e.bounds.r
      },
      UnitOfWork.immediate($d)
    );
    if (isNode(e)) {
      assignNewBounds(e.children, bounds, point, scaleX, scaleY, $d);
    }
  }
};

export const canvasDropHandler = ($d: Diagram) => {
  return (e: DragEvent) => {
    const draggable = JSON.parse(
      e.dataTransfer!.getData('application/x-diagram-craft-elements')
    ) as ElementsDraggable;

    // TODO: Merge any attachments

    const droppedElements = deserializeDiagramElements(
      draggable.elements,
      $d,
      $d.layers.active,
      {},
      {}
    );

    // Change the ids of all dropped elements
    assignNewIds(droppedElements);

    const bounds = Box.boundingBox(droppedElements.map(e => e.bounds));

    const scaleX = draggable.dimensions.w / bounds.w;
    const scaleY = draggable.dimensions.h / bounds.h;

    const point = $d.viewBox.toDiagramPoint(EventHelper.point(e));
    assignNewBounds(droppedElements, bounds, point, scaleX, scaleY, $d);

    $d.undoManager.addAndExecute(new ElementAddUndoableAction(droppedElements, $d));

    $d.selectionState.clear();
    $d.selectionState.setElements(droppedElements);
  };
};

export const canvasDragOverHandler = () => {
  return (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  };
};

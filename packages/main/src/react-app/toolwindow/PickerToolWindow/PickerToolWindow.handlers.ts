import { Diagram } from '@diagram-craft/model/diagram';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import { SerializedElement } from '@diagram-craft/model/serialization/types';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { Extent } from '@diagram-craft/geometry/extent';
import { assignNewBounds, assignNewIds } from '@diagram-craft/model/helpers/cloneHelper';

type ElementsDraggable = {
  elements: Array<SerializedElement>;
  attachments: Record<string, string>;
  dimensions: Extent;
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
    assignNewBounds(droppedElements, point, scaleX, scaleY, $d, UnitOfWork.immediate($d));

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

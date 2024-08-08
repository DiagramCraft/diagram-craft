import { Diagram } from '@diagram-craft/model/diagram';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import { SerializedElement } from '@diagram-craft/model/serialization/types';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { Extent } from '@diagram-craft/geometry/extent';
import { assignNewBounds, assignNewIds } from '@diagram-craft/model/helpers/cloneHelper';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';

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
    assignNewBounds(droppedElements, point, { x: scaleX, y: scaleY }, UnitOfWork.immediate($d));

    const uow = UnitOfWork.immediate($d);
    droppedElements.forEach(e => {
      if (isNode(e)) {
        e.updateMetadata(meta => {
          if (meta.style === DefaultStyles.node.default) {
            meta.style = $d.document.styles.activeNodeStylesheet.id;
          }
          if (meta.textStyle === DefaultStyles.text.default) {
            meta.textStyle = $d.document.styles.activeTextStylesheet.id;
          }
        }, uow);
      } else if (isEdge(e)) {
        e.updateMetadata(meta => (meta.style = $d.document.styles.activeEdgeStylesheet.id), uow);
      }
    });
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

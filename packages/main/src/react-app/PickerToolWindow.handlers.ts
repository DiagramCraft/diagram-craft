import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { newid } from '@diagram-craft/utils/id';
import { deepMerge } from '@diagram-craft/utils/object';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export const canvasDropHandler = ($d: Diagram) => {
  return (e: DragEvent) => {
    const nodeType = e.dataTransfer!.getData('application/x-diagram-craft-node-type');
    const nodeDef = $d.document.nodeDefinitions.get(nodeType);
    const registration = $d.document.nodeDefinitions
      .getRegistrations(nodeType)
      .find(r => r.key === e.dataTransfer!.getData('application/x-diagram-craft-node-key'));

    const nd = new DiagramNode(
      newid(),
      nodeType,
      {
        ...$d.viewBox.toDiagramPoint(EventHelper.point(e)),
        w: 10,
        h: 10,
        r: 0
      },
      $d,
      $d.layers.active,

      deepMerge(nodeDef.getDefaultProps('canvas'), registration?.props ?? {})
    );

    nd.setBounds(
      {
        ...nd.bounds,
        ...nodeDef.getDefaultConfig(nd).size
      },
      UnitOfWork.throwaway($d)
    );

    $d.undoManager.addAndExecute(new ElementAddUndoableAction([nd], $d));

    $d.selectionState.clear();
    $d.selectionState.toggle(nd);

    if (nodeType === 'text') {
      setTimeout(() => {
        $d.document.nodeDefinitions.get(nodeType).requestFocus(nd);
      }, 10);
    }
  };
};

export const canvasDragOverHandler = () => {
  return (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  };
};

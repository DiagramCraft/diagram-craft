import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { newid } from '@diagram-craft/utils/id';

export const canvasDropHandler = ($d: Diagram) => {
  return (e: DragEvent) => {
    const nodeType = e.dataTransfer!.getData('application/x-diagram-craft-node-type');
    const nodeDef = $d.document.nodeDefinitions.get(nodeType);

    const nd = new DiagramNode(
      newid(),
      nodeType,
      {
        ...$d.viewBox.toDiagramPoint(EventHelper.point(e)),
        ...nodeDef.getDefaultConfig().size,
        r: 0
      },
      $d,
      $d.layers.active,
      nodeDef.getDefaultProps('canvas')
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

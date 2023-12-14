import { DeferedMouseAction } from './types.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DragDropContextType } from '../../react-canvas-viewer/DragDropManager.tsx';
import { MutableRefObject, RefObject } from 'react';
import { Point } from '../../geometry/point.ts';
import { Modifiers } from '../../base-ui/drag.ts';
import { AbstractTool } from './abstractTool.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';
import { newid } from '../../utils/id.ts';
import { NodeAddAction } from '../../model-viewer/actions.ts';

export class TextTool extends AbstractTool {
  constructor(
    protected readonly diagram: EditableDiagram,
    protected readonly drag: DragDropContextType,
    protected readonly svgRef: RefObject<SVGSVGElement>,
    protected readonly deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    protected readonly resetTool: () => void
  ) {
    super(diagram, drag, svgRef, deferedMouseAction, resetTool);
    this.svgRef.current!.style.cursor = 'text';
  }

  onMouseDown(_id: string, _point: Point, _modifiers: Modifiers) {
    // Do nothing
  }

  onMouseUp(_point: Point) {
    const nodeType = 'text';
    const nodeDef = this.diagram.nodeDefinitions.get(nodeType);

    const nd = new DiagramNode(
      newid(),
      nodeType,
      {
        pos: this.diagram.viewBox.toDiagramPoint(_point),
        size: nodeDef.getInitialConfig().size,
        rotation: 0
      },
      undefined,
      nodeDef.getDefaultProps('canvas')
    );

    this.diagram.undoManager.addAndExecute(new NodeAddAction([nd], this.diagram, 'Add text'));

    this.diagram.selectionState.clear();
    this.diagram.selectionState.toggle(nd);

    this.resetTool();
  }

  onMouseMove(_point: Point, _modifiers: Modifiers) {
    // Do nothing
  }
}

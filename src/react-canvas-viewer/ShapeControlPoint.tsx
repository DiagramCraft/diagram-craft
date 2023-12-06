import { DiagramNode } from '../model-viewer/diagram.ts';
import { useDragDrop } from './DragDropManager.tsx';
import { Drag, Modifiers } from '../base-ui/drag.ts';
import { Point } from '../geometry/point.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';

class ShapeControlPointDrag implements Drag {
  constructor(
    private readonly diagram: EditableDiagram,
    private readonly node: DiagramNode,
    private readonly callback: (x: number, y: number) => void
  ) {}

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.callback(coord.x, coord.y);
    this.diagram.updateElement(this.node);
  }

  onDragEnd(_coord: Point): void {}
}

export const ShapeControlPoint = (props: Props) => {
  const drag = useDragDrop();

  return (
    <circle
      cx={props.x}
      cy={props.y}
      r={5}
      stroke="red"
      fill={'transparent'}
      cursor={'crosshair'}
      onMouseDown={e => {
        if (e.button !== 0) return;
        drag.initiateDrag(new ShapeControlPointDrag(props.diagram, props.def, props.onDrag));
        e.stopPropagation();
      }}
    />
  );
};

type Props = {
  x: number;
  y: number;
  onDrag: (x: number, y: number) => void;
  def: DiagramNode;
  diagram: EditableDiagram;
};

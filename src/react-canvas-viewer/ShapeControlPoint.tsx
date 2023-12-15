import { useDragDrop } from './DragDropManager.tsx';
import { Drag, Modifiers } from '../base-ui/drag.ts';
import { Point } from '../geometry/point.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { Diagram } from '../model/diagram.ts';

class ShapeControlPointDrag implements Drag {
  constructor(
    private readonly node: DiagramNode,
    private readonly callback: (x: number, y: number) => void
  ) {}

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.callback(coord.x, coord.y);
    this.node.commitChanges();
  }

  onDragEnd(): void {}
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
        drag.initiateDrag(new ShapeControlPointDrag(props.def, props.onDrag));
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
  diagram: Diagram;
};

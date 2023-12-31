import { useDragDrop } from './DragDropManager.tsx';
import { DiagramNode } from '../model/diagramNode.ts';
import { Diagram } from '../model/diagram.ts';
import { ShapeControlPointDrag } from '../base-ui/drag/shapeControlDrag.ts';

export const ShapeControlPoint = (props: Props) => {
  const drag = useDragDrop();

  return (
    <circle
      className={'svg-shape-control-point'}
      cx={props.x}
      cy={props.y}
      r={5}
      onMouseDown={e => {
        if (e.button !== 0) return;
        drag.initiate(new ShapeControlPointDrag(props.def, props.onDrag));
        e.stopPropagation();
      }}
    />
  );
};

type Props = {
  x: number;
  y: number;
  onDrag: (x: number, y: number) => string;
  def: DiagramNode;
  diagram: Diagram;
};

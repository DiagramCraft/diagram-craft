import { DiagramEdge } from '../../model/diagramEdge.ts';
import { $c } from '../../utils/classname.ts';
import { EdgeEndpointMoveDrag } from '../../base-ui/drag/edgeEndpointMoveDrag.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.tsx';
import { Diagram } from '../../model/diagram.ts';

export const EdgeSelection = (props: Props) => {
  const drag = useDragDrop();
  return (
    <>
      <circle
        cx={props.edge.startPosition.x}
        cy={props.edge.startPosition.y}
        r="4"
        className={$c('svg-selection__handle-edge', { connected: props.edge.isStartConnected() })}
        onMouseDown={ev => {
          if (ev.button !== 0) return;
          drag.initiate(
            new EdgeEndpointMoveDrag(props.diagram, props.edge, ev.currentTarget, 'start')
          );
          ev.stopPropagation();
        }}
      />
      <circle
        cx={props.edge.endPosition.x}
        cy={props.edge.endPosition.y}
        r="4"
        className={$c('svg-selection__handle-edge', { connected: props.edge.isEndConnected() })}
        onMouseDown={ev => {
          if (ev.button !== 0) return;
          drag.initiate(
            new EdgeEndpointMoveDrag(props.diagram, props.edge, ev.currentTarget, 'end')
          );
          ev.stopPropagation();
        }}
      />
    </>
  );
};

type Props = {
  diagram: Diagram;
  edge: DiagramEdge;
};

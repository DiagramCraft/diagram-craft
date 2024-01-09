import { DiagramEdge } from '../../model/diagramEdge.ts';
import { $c } from '../../utils/classname.ts';
import { EdgeEndpointMoveDrag } from '../../base-ui/drag/edgeEndpointMoveDrag.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.ts';
import { Diagram } from '../../model/diagram.ts';
import { useState } from 'react';
import { useEventListener } from '../../react-app/hooks/useEventListener.ts';

export const EdgeSelection = (props: Props) => {
  const drag = useDragDrop();

  const [isDragging, setIsDragging] = useState(!!drag.current());

  useEventListener(drag, 'dragStart', () => {
    setIsDragging(true);
  });

  useEventListener(drag, 'dragEnd', () => {
    setIsDragging(false);
  });

  return (
    <>
      <circle
        cx={props.edge.startPosition.x}
        cy={props.edge.startPosition.y}
        r="4"
        className={$c('svg-selection__handle-edge', { connected: props.edge.isStartConnected() })}
        onMouseDown={ev => {
          if (ev.button !== 0) return;
          drag.initiate(new EdgeEndpointMoveDrag(props.diagram, props.edge, 'start'));
          ev.stopPropagation();
        }}
        style={{ pointerEvents: isDragging ? 'none' : undefined }}
      />
      <circle
        cx={props.edge.endPosition.x}
        cy={props.edge.endPosition.y}
        r="4"
        className={$c('svg-selection__handle-edge', { connected: props.edge.isEndConnected() })}
        onMouseDown={ev => {
          if (ev.button !== 0) return;
          drag.initiate(new EdgeEndpointMoveDrag(props.diagram, props.edge, 'end'));
          ev.stopPropagation();
        }}
        style={{ pointerEvents: isDragging ? 'none' : undefined }}
      />
    </>
  );
};

type Props = {
  diagram: Diagram;
  edge: DiagramEdge;
};

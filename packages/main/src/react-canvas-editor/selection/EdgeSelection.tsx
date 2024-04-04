import { DiagramEdge } from '../../model/diagramEdge.ts';
import { $c } from '../../utils/classname.ts';
import { EdgeEndpointMoveDrag } from '../../base-ui/drag/edgeEndpointMoveDrag.ts';
import { DRAG_DROP_MANAGER } from '../../react-canvas-viewer/DragDropManager.ts';
import { isConnected } from '../../model/endpoint.ts';
import { Component } from '../../base-ui/component.ts';
import { Diagram } from '../../model/diagram.ts';
import * as svg from '../../base-ui/vdom-svg.ts';

type ComponentProps = Props & {
  diagram: Diagram;
};

export class EdgeSelectionComponent extends Component<ComponentProps> {
  private dragging: boolean = false;
  private readonly onDragStart: () => void;
  private readonly onDragEnd: () => void;

  constructor() {
    super();
    this.onDragStart = () => this.setIsDragging(true);
    this.onDragEnd = () => this.setIsDragging(false);
  }

  setIsDragging(state: boolean) {
    this.dragging = state;
    this.redraw();
  }

  onAttach() {
    DRAG_DROP_MANAGER.on('dragStart', this.onDragStart);
    DRAG_DROP_MANAGER.on('dragEnd', this.onDragEnd);
  }

  onDetach() {
    DRAG_DROP_MANAGER.off('dragStart', this.onDragStart);
    DRAG_DROP_MANAGER.off('dragEnd', this.onDragEnd);
  }

  render(props: ComponentProps) {
    const diagram = props.diagram;
    const drag = DRAG_DROP_MANAGER;

    const edge = props.edge;

    return svg.g(
      {},
      svg.circle({
        class: $c('svg-selection__handle-edge', { connected: isConnected(edge.start) }),
        cx: edge.start.position.x,
        cy: edge.start.position.y,
        r: 4,
        on: {
          mousedown: ev => {
            if (ev.button !== 0) return;
            drag.initiate(new EdgeEndpointMoveDrag(diagram, edge, 'start'));
            ev.stopPropagation();
          }
        },
        style: `pointer-events: ${this.dragging ? 'none' : undefined}`
      }),
      svg.circle({
        class: $c('svg-selection__handle-edge', { connected: isConnected(edge.end) }),
        cx: edge.end.position.x,
        cy: edge.end.position.y,
        r: 4,
        on: {
          mousedown: ev => {
            if (ev.button !== 0) return;
            drag.initiate(new EdgeEndpointMoveDrag(diagram, edge, 'end'));
            ev.stopPropagation();
          }
        },
        style: `pointer-events: ${this.dragging ? 'none' : undefined}`
      })
    );
  }
}

/*
export const EdgeSelection = (props: Props) => {
const diagram = useDiagram();
const ref = useComponent<ComponentProps, EdgeSelectionComponent, SVGGElement>(
  () => new EdgeSelectionComponent(),
  {
    ...props,
    diagram
  }
);

return <g ref={ref}></g>;

const drag = DRAG_DROP_MANAGER;

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
      cx={props.edge.start.position.x}
      cy={props.edge.start.position.y}
      r="4"
      className={$c('svg-selection__handle-edge', { connected: isConnected(props.edge.start) })}
      onMouseDown={ev => {
        if (ev.button !== 0) return;
        drag.initiate(new EdgeEndpointMoveDrag(diagram, props.edge, 'start'));
        ev.stopPropagation();
      }}
      style={{ pointerEvents: isDragging ? 'none' : undefined }}
    />
    <circle
      cx={props.edge.end.position.x}
      cy={props.edge.end.position.y}
      r="4"
      className={$c('svg-selection__handle-edge', { connected: isConnected(props.edge.end) })}
      onMouseDown={ev => {
        if (ev.button !== 0) return;
        drag.initiate(new EdgeEndpointMoveDrag(diagram, props.edge, 'end'));
        ev.stopPropagation();
      }}
      style={{ pointerEvents: isDragging ? 'none' : undefined }}
    />
  </>
);

};
*/

type Props = {
  edge: DiagramEdge;
};

import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { Component, onEvent } from '../component/component';
import * as svg from '../component/vdom-svg';
import { EdgeEndpointMoveDrag } from '../drag/edgeEndpointMoveDrag';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { ConnectedEndpoint, EdgeConnectedEndpoint } from '@diagram-craft/model/endpoint';
import { $c } from '@diagram-craft/utils/classname';
import { Zoom } from './zoom';
import { Context } from '../context';

const isConnectedEndpoint = (endpoint: DiagramEdge['start']) =>
  endpoint instanceof ConnectedEndpoint || endpoint instanceof EdgeConnectedEndpoint;

export class EdgeSelectionComponent extends Component<Props> {
  render(props: Props) {
    const { diagram, edge } = props;

    onEvent(DRAG_DROP_MANAGER, 'dragStart', () => this.redraw());
    onEvent(DRAG_DROP_MANAGER, 'dragEnd', () => this.redraw());

    const z = new Zoom(diagram.viewBox.zoomLevel);

    return svg.g(
      {},
      svg.circle({
        class: `svg-handle ${$c('svg-selection__handle-edge', { connected: isConnectedEndpoint(edge.start) })}`,
        cx: edge.start.position.x,
        cy: edge.start.position.y,
        r: z.num(4, 1.5),
        on: {
          mousedown: ev => {
            if (ev.button !== 0) return;
            DRAG_DROP_MANAGER.initiate(
              new EdgeEndpointMoveDrag(diagram, edge, 'start', props.context)
            );
            ev.stopPropagation();
          }
        },
        style: `pointer-events: ${DRAG_DROP_MANAGER.isDragging() ? 'none' : 'unset'}`
      }),
      svg.circle({
        class: `svg-handle ${$c('svg-selection__handle-edge', { connected: isConnectedEndpoint(edge.end) })}`,
        cx: edge.end.position.x,
        cy: edge.end.position.y,
        r: z.num(4, 1.5),
        on: {
          mousedown: ev => {
            if (ev.button !== 0) return;
            DRAG_DROP_MANAGER.initiate(
              new EdgeEndpointMoveDrag(diagram, edge, 'end', props.context)
            );
            ev.stopPropagation();
          }
        },
        style: `pointer-events: ${DRAG_DROP_MANAGER.isDragging() ? 'none' : 'unset'}`
      })
    );
  }
}

type Props = {
  diagram: Diagram;
  edge: DiagramEdge;
  context: Context;
};

import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { EdgeEndpointMoveDrag } from '../drag/edgeEndpointMoveDrag';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { $c } from '@diagram-craft/utils/classname';
import { ApplicationTriggers } from '../EditableCanvasComponent';
import { Zoom } from './zoom';

export class EdgeSelectionComponent extends Component<Props> {
  render(props: Props) {
    const { diagram, edge } = props;

    createEffect(() => {
      const cb = () => this.redraw();

      DRAG_DROP_MANAGER.on('dragStart', cb);
      return () => DRAG_DROP_MANAGER.off('dragStart', cb);
    }, []);

    createEffect(() => {
      const cb = () => this.redraw();

      DRAG_DROP_MANAGER.on('dragEnd', cb);
      return () => DRAG_DROP_MANAGER.off('dragEnd', cb);
    }, []);

    const z = new Zoom(diagram.viewBox.zoomLevel);

    return svg.g(
      {},
      svg.circle({
        class: $c('svg-handle svg-selection__handle-edge', { connected: edge.start.isConnected }),
        cx: edge.start.position.x,
        cy: edge.start.position.y,
        r: z.num(4, 1.5),
        on: {
          mousedown: ev => {
            if (ev.button !== 0) return;
            DRAG_DROP_MANAGER.initiate(
              new EdgeEndpointMoveDrag(diagram, edge, 'start', props.applicationTriggers)
            );
            ev.stopPropagation();
          }
        },
        style: `pointer-events: ${DRAG_DROP_MANAGER.isDragging() ? 'none' : 'unset'}`
      }),
      svg.circle({
        class: $c('svg-handle svg-selection__handle-edge', { connected: edge.end.isConnected }),
        cx: edge.end.position.x,
        cy: edge.end.position.y,
        r: z.num(4, 1.5),
        on: {
          mousedown: ev => {
            if (ev.button !== 0) return;
            DRAG_DROP_MANAGER.initiate(
              new EdgeEndpointMoveDrag(diagram, edge, 'end', props.applicationTriggers)
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
  applicationTriggers: ApplicationTriggers;
};

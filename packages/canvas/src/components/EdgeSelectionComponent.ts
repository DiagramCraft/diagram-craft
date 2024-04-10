import { DiagramEdge } from '@diagram-craft/model';
import { $c } from '@diagram-craft/utils';
import { DRAG_DROP_MANAGER } from '../dragDropManager.ts';
import { isConnected } from '@diagram-craft/model';
import { Component } from '../component/component.ts';
import { Diagram } from '@diagram-craft/model';
import * as svg from '../component/vdom-svg.ts';
import { EdgeEndpointMoveDrag } from '../drag/edgeEndpointMoveDrag.ts';

export class EdgeSelectionComponent extends Component<Props> {
  private dragging: boolean = false;

  setIsDragging(state: boolean) {
    this.dragging = state;
    this.redraw();
  }

  render(props: Props) {
    const diagram = props.diagram;
    const edge = props.edge;

    this.effectManager.add(() => {
      const cb = () => this.setIsDragging(true);
      DRAG_DROP_MANAGER.on('dragStart', cb);
      return () => DRAG_DROP_MANAGER.off('dragStart', cb);
    }, []);

    this.effectManager.add(() => {
      const cb = () => this.setIsDragging(false);
      DRAG_DROP_MANAGER.on('dragEnd', cb);
      return () => DRAG_DROP_MANAGER.off('dragEnd', cb);
    }, []);

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
            DRAG_DROP_MANAGER.initiate(new EdgeEndpointMoveDrag(diagram, edge, 'start'));
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
            DRAG_DROP_MANAGER.initiate(new EdgeEndpointMoveDrag(diagram, edge, 'end'));
            ev.stopPropagation();
          }
        },
        style: `pointer-events: ${this.dragging ? 'none' : undefined}`
      })
    );
  }
}

type Props = {
  diagram: Diagram;
  edge: DiagramEdge;
};

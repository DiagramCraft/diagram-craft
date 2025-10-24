import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { RotateDrag } from '../drag/rotateDrag';
import { Diagram } from '@diagram-craft/model/diagram';
import { Zoom } from './zoom';

type Props = {
  diagram: Diagram;
};

export class RotationHandleComponent extends Component<Props> {
  render(props: Props) {
    const { diagram } = props;

    const selection = diagram.selection;
    const bounds = selection.bounds;

    if (selection.nodes.some(p => p.renderProps.capabilities.rotatable === false)) {
      return svg.g({});
    }

    const z = new Zoom(diagram.viewBox.zoomLevel);

    return svg.g(
      {
        class: 'svg-rotation-handle',
        on: {
          mousedown: e => {
            if (e.button !== 0) return;
            DRAG_DROP_MANAGER.initiate(new RotateDrag(diagram));
            e.stopPropagation();
          }
        }
      },
      svg.marker(
        {
          id: `rotation_marker`,
          viewBox: '0 0 10 10',
          refX: 7,
          refY: 5,
          markerWidth: 4,
          markerHeight: 4,
          orient: 'auto-start-reverse'
        },
        svg.path({ d: 'M 0 0 L 10 5 L 0 10 z', stroke: 'var(--accent-9)', fill: 'var(--accent-9)' })
      ),
      svg.path({
        d: `M ${bounds.x + bounds.w} ${bounds.y - z.num(10, 5)} a ${z.num(10, 5)} ${z.num(10, 5)} 45 0 1 ${z.num(10, 5)} ${z.num(10, 5)}`,
        class: 'svg-rotation-handle__backing',
        cursor: 'nwse-resize'
      }),
      svg.path({
        'd': `M ${bounds.x + bounds.w} ${bounds.y - z.num(10, 5)} a ${z.num(10, 5)} ${z.num(10, 5)} 45 0 1 ${z.num(10, 5)} ${z.num(10, 5)}`,
        'marker-end': `url(#rotation_marker)`,
        'marker-start': `url(#rotation_marker)`,
        'pointer-events': 'none',
        'cursor': 'nwse-resize'
      })
    );
  }
}

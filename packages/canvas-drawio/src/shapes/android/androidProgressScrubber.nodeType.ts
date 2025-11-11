import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      androidProgressScrubber?: {
        dx?: number;
        state?: 'disabled' | 'focused' | 'pressed';
      };
    }
  }
}

registerCustomNodeDefaults('androidProgressScrubber', { dx: 0.5, state: 'disabled' });

export class AndroidProgressScrubber extends SimpleShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.progressScrubber');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, builder: ShapeBuilder) {
    const { w, h } = props.node.bounds;
    const yMid = h / 2;

    const { dx, state } = props.nodeProps.custom.androidProgressScrubber;
    const c = props.node.renderProps.fill.color;

    const b = builder.buildBoundary();
    b.path(0, yMid).line(w, yMid);
    b.stroke({ color: '#444444' });

    if (state === 'disabled') {
      b.circle(dx * w, yMid, 10);
      b.fill({ color: 'rgba(102, 102, 102, 0.5)' });
    } else {
      b.path(0, yMid).line(dx * w, yMid);
      b.stroke();

      b.circle(dx * w, yMid, 10);
      b.fill({
        color: `color-mix(in srgb, ${c}, transparent ${state === 'focused' ? '25%' : '50%'})`
      });

      if (state === 'pressed') {
        b.circle(dx * w, yMid, 9.25);
        b.stroke({ color: c, width: 0.5 });
      }
    }

    b.restore();
    b.circle(dx * w, yMid, 2);
    b.fill();
  }
}

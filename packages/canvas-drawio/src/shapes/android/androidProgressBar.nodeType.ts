import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      androidProgressBar?: {
        width?: number;
        dx1?: number;
        dx2?: number;
      };
    }
  }
}

registerCustomNodeDefaults('androidProgressBar', { width: 2, dx1: 0.25, dx2: 0.75 });

export class AndroidProgressBarDefinition extends SimpleShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.progressBar');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, builder: ShapeBuilder) {
    const { w, h } = props.node.bounds;
    const { width, dx1, dx2 } = props.nodeProps.custom.androidProgressBar;

    const b = builder.buildBoundary();
    b.path(0, h * 0.5).line(w, h * 0.5);
    b.stroke({ color: '#444444', width });

    b.restore();
    b.path(0, h * 0.5).line(dx1 * w, h * 0.5);
    b.stroke();

    b.path(0, h * 0.5).line(dx1 * w, h * 0.5);
    b.stroke({ color: 'rgba(0, 0, 0, 0.2)', width });

    b.restore();
    b.path(0, h * 0.5).line(dx2 * w, h * 0.5);
    b.stroke();
  }
}
